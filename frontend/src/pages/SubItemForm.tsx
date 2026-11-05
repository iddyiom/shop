// New sub-item (/items/:groupId/new-sub-item) or edit sub-item (/items/sub-items/:productId/edit).
// Owner only. A price change on an existing sub-item goes through the confirm step first.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { apiPatch, apiPost, apiPut } from '../api';
import PageHeader from '../components/PageHeader';
import PriceConfirm from '../components/PriceConfirm';
import { formatTsh } from '../format';
import { parseLevel, parseTsh } from '../money';
import type { Group, Product } from '../types';
import { errorMessage, useApi } from '../useApi';

type PriceMode = 'item' | 'own';
type Changes = { name?: string; min_level?: number }; // only what the owner changed
type PendingSave = { changes: Changes; newPrice: number | null }; // waiting for "Yes, change"

export default function SubItemForm() {
  const { groupId, productId } = useParams();
  const isNew = productId === undefined;
  const navigate = useNavigate();

  const groups = useApi<Group[]>('/groups?include_stopped=true');
  const products = useApi<Product[]>(isNew ? null : '/products?include_stopped=true');
  const product = isNew ? null : (products.data ?? []).find((p) => p.id === Number(productId)) ?? null;
  const wantedGroupId = isNew ? Number(groupId) : product?.group_id;
  const group = (groups.data ?? []).find((g) => g.id === wantedGroupId) ?? null;

  const [name, setName] = useState('');
  const [mode, setMode] = useState<PriceMode>('item');
  const [ownPrice, setOwnPrice] = useState('');
  const [level, setLevel] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingSave | null>(null);

  useEffect(() => {
    if (!product) return; // fill the form once the sub-item has loaded
    setName(product.name);
    setMode(product.own_price === null ? 'item' : 'own');
    setOwnPrice(product.own_price === null ? '' : String(product.own_price));
    setLevel(String(product.min_level));
  }, [product]);

  function done(notice: string) {
    navigate('/items', { state: { notice } });
  }

  /** Read the form. Returns null (and shows a message) if something is wrong. */
  function readForm(): { name: string; ownPrice: number | null; level: number } | null {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter a name.');
      return null;
    }
    const parsedLevel = parseLevel(level);
    if (!parsedLevel.ok) {
      setError(parsedLevel.error);
      return null;
    }
    if (mode === 'item') return { name: trimmed, ownPrice: null, level: parsedLevel.value };
    const parsedPrice = parseTsh(ownPrice);
    if (!parsedPrice.ok) {
      setError(parsedPrice.error);
      return null;
    }
    return { name: trimmed, ownPrice: parsedPrice.value, level: parsedLevel.value };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !group) return;
    setError(null);
    const form = readForm();
    if (!form) return;

    if (isNew) {
      setBusy(true);
      try {
        await apiPost<Product>('/products', {
          group_id: group.id,
          name: form.name,
          own_price: form.ownPrice, // null = use the item price
          min_level: form.level,
        });
        done(`${form.name} added to ${group.name}`);
      } catch (err) {
        setError(errorMessage(err)); // e.g. "This item is stopped. Bring it back first."
        setBusy(false);
      }
      return;
    }

    if (!product) return;
    const changes: Changes = {};
    if (form.name !== product.name) changes.name = form.name;
    if (form.level !== product.min_level) changes.min_level = form.level;

    if (form.ownPrice !== product.own_price) {
      setPending({ changes, newPrice: form.ownPrice }); // a price change: confirm first
      return;
    }
    if (Object.keys(changes).length === 0) return done('Nothing changed');
    await apply(changes, undefined);
  }

  /** Send the changes: the PATCH (if any), then the price PUT (if confirmed). */
  async function apply(changes: Changes, newPrice: number | null | undefined) {
    if (!product) return;
    setBusy(true);
    try {
      if (Object.keys(changes).length > 0) await apiPatch<Product>(`/products/${product.id}`, changes);
      if (newPrice !== undefined) await apiPut(`/products/${product.id}/price`, { price: newPrice });
      done(`${changes.name ?? product.name} saved`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
      setBusy(false);
    }
  }

  async function setSelling(isActive: boolean) {
    if (!product || busy) return;
    setBusy(true);
    try {
      await apiPatch<Product>(`/products/${product.id}`, { is_active: isActive });
      done(isActive ? `${product.name} is selling again` : `${product.name} stopped`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (groups.loading || (!isNew && products.loading)) {
    return (
      <p className="panel-state" role="status">
        Loading…
      </p>
    );
  }
  if (!group || (!isNew && !product)) {
    return (
      <>
        <PageHeader eyebrow="ITEMS" title="Not found" tabTitle="Not found" />
        <p className="coming-soon">
          {groups.error ?? products.error ?? 'This item or sub-item does not exist.'}{' '}
          <Link to="/items">Back to items and prices</Link>
        </p>
      </>
    );
  }

  const itemPriceLabel = `Item price (TSh ${formatTsh(group.current_price)})`;
  const priceLabel = (price: number | null) => (price === null ? itemPriceLabel : `TSh ${formatTsh(price)}`);

  return (
    <>
      <Link to="/items" className="back-link">
        ← Back to items and prices
      </Link>
      <PageHeader
        eyebrow="ITEMS · OWNER ONLY"
        title={isNew ? `New sub-item in ${group.name}` : `Edit ${product?.name}`}
        tabTitle={isNew ? 'New sub-item' : 'Edit sub-item'}
      />

      {pending && product ? (
        <div className="narrow">
          <PriceConfirm
            title={`${product.name}: change the price?`}
            oldLabel={priceLabel(product.own_price)}
            newLabel={priceLabel(pending.newPrice)}
            affects={[]}
            oldReceiptPrice={product.effective_price}
            busy={busy}
            error={error}
            onConfirm={() => apply(pending.changes, pending.newPrice)}
            onCancel={() => setPending(null)}
          />
        </div>
      ) : (
        <form className="form-card narrow" onSubmit={save} noValidate>
          <p className="form-lead">
            In item: {group.name} · item price TSh {formatTsh(group.current_price)}
            {product ? ` · ${product.quantity_in_store} in store` : ' · starts with 0 in store'}
          </p>
          <div className="field">
            <label htmlFor="sub-name">Name</label>
            <input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>

          <fieldset className="price-choice">
            <legend>Price</legend>
            <div className="choice-grid">
              <button type="button" className="choice" aria-pressed={mode === 'item'} onClick={() => setMode('item')}>
                <strong>Use item price</strong>
                <span>TSh {formatTsh(group.current_price)}, follows {group.name}</span>
              </button>
              <button type="button" className="choice" aria-pressed={mode === 'own'} onClick={() => setMode('own')}>
                <strong>Own price</strong>
                <span>A different price for this one</span>
              </button>
            </div>
          </fieldset>
          {mode === 'own' && (
            <div className="field">
              <label htmlFor="sub-own-price">Own price (TSh)</label>
              <input
                id="sub-own-price"
                inputMode="numeric"
                value={ownPrice}
                onChange={(e) => setOwnPrice(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="sub-level">Low-stock level</label>
            <input id="sub-level" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
            <span className="field-hint">Shown as LOW at or below this number. 0 = no warning.</span>
          </div>

          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Add sub-item' : 'Save changes'}
          </button>
        </form>
      )}

      {product && !pending && (
        <section className="form-card narrow" aria-labelledby="sub-selling-title">
          <h2 id="sub-selling-title">{product.is_active ? 'Stop selling' : 'Bring back'}</h2>
          <p className="field-hint">
            {product.is_active
              ? `Stops selling. Keeps its ${product.quantity_in_store} in store and all its history. Nothing is deleted.`
              : `Sells again, with the same ${product.quantity_in_store} in store.`}
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setSelling(!product.is_active)}
            disabled={busy}
          >
            {product.is_active ? `Stop selling ${product.name}` : `Bring back ${product.name}`}
          </button>
        </section>
      )}
    </>
  );
}
