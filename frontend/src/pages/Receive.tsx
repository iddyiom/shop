// Receive stock: record what the truck brought. One Save for all lines (all or nothing).
// Spec: docs/specs/f06-receive.md. Owner and shopkeeper; only the owner has buying prices.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { apiPost } from '../api';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import { shortDate } from '../format';
import { parseQuantity, parseTsh } from '../money';
import type { Delivery, Product, Summary } from '../types';
import { errorMessage, useApi } from '../useApi';
import { useCurrentUser } from '../user';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const LAST_DELIVERIES = 5;

/** One row of the form, as typed (text until it is checked). */
type LineDraft = {
  key: number; // React needs a stable key per row
  productId: string; // '' = not chosen yet
  quantity: string;
  buyingPrice: string; // owner only; '' = not known
};

let nextKey = 1;
const emptyLine = (): LineDraft => ({ key: nextKey++, productId: '', quantity: '', buyingPrice: '' });

/** "Line 2: enter a quantity." */
function lineMessage(index: number, message: string): string {
  return `Line ${index + 1}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
}

/** Units on a delivery: a count shown on screen, never money. */
function unitsOf(delivery: Delivery): number {
  return delivery.items.reduce((sum, line) => sum + line.quantity, 0);
}

export default function Receive() {
  const user = useCurrentUser();
  const isOwner = user.role === 'owner';

  const summary = useApi<Summary>('/summary/today'); // the server's "today"
  const products = useApi<Product[]>('/products'); // active sub-items only
  const deliveries = useApi<Delivery[]>('/deliveries');

  const [pickedDate, setPickedDate] = useState<string | null>(null); // null = not changed by the person
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()]);
  const [error, setError] = useState<{ message: string; line: number | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rule 1: start on today as the SERVER sees it (never the laptop's clock).
  // Worked out on every draw (no useEffect), so there is never a moment with an empty date.
  const today = summary.data?.date;
  const date = pickedDate ?? today ?? '';
  const productList = products.data ?? [];
  const productById = new Map(productList.map((p) => [p.id, p]));

  function updateLine(key: number, change: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));
    setError(null);
    setNotice(null);
  }

  // ---------- The preview (rule 3: the server does the real adding) ----------
  const arriving = new Map<number, number>(); // product id → units on this delivery
  let unitsArriving = 0;
  for (const line of lines) {
    const quantity = parseQuantity(line.quantity);
    if (!line.productId || !quantity.ok) continue;
    const id = Number(line.productId);
    arriving.set(id, (arriving.get(id) ?? 0) + quantity.value); // same sub-item twice: both count
    unitsArriving += quantity.value;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setNotice(null);

    // Rule 5: quick checks first (the server checks everything again).
    if (!date) return setError({ message: 'Choose the delivery date.', line: null });
    const items: { product_id: number; quantity: number; buying_price?: number }[] = [];
    for (const [index, line] of lines.entries()) {
      if (!line.productId) return setError({ message: lineMessage(index, 'Choose a sub-item.'), line: index });
      const quantity = parseQuantity(line.quantity);
      if (!quantity.ok) return setError({ message: lineMessage(index, quantity.error), line: index });
      const item: (typeof items)[number] = { product_id: Number(line.productId), quantity: quantity.value };
      // Rule 2: only the owner sends a buying price, and only when one was typed.
      if (isOwner && line.buyingPrice.trim() !== '') {
        const price = parseTsh(line.buyingPrice);
        if (!price.ok) return setError({ message: lineMessage(index, price.error), line: index });
        item.buying_price = price.value;
      }
      items.push(item);
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await apiPost<Delivery>('/deliveries', {
        delivered_at: date,
        note: note.trim() || null,
        items,
      });
      const lineWord = saved.items.length === 1 ? 'line' : 'lines';
      setNotice(`Delivery saved: ${saved.items.length} ${lineWord}, ${unitsOf(saved)} units`);
      setLines([emptyLine()]); // fresh form; the date stays
      setNote('');
      products.reload(); // show the stock the SERVER has now
      deliveries.reload();
    } catch (err) {
      // Rule 4: nothing was saved; keep everything typed so one line can be fixed.
      setError({ message: errorMessage(err), line: null });
    } finally {
      setBusy(false);
    }
  }

  // Group the choices by item: Soda → Fanta, Sprite…
  const byGroup = new Map<string, Product[]>();
  for (const product of productList) {
    byGroup.set(product.group, [...(byGroup.get(product.group) ?? []), product]);
  }

  const header = <PageHeader title="Receive stock" subtitle="The truck came. Write down what arrived." />;

  if (products.loading || summary.loading) {
    return (
      <>
        {header}
        <Skeleton />
      </>
    );
  }
  if (products.error || summary.error) {
    return (
      <>
        {header}
        <div className="panel-state">
          <p role="alert">{products.error ?? summary.error}</p>
          <button
            type="button"
            className="pill-button"
            onClick={() => {
              products.reload();
              summary.reload();
            }}
          >
            Try again
          </button>
        </div>
      </>
    );
  }
  if (productList.length === 0) {
    return (
      <>
        {header}
        <div className="empty-card">
          <h2>No items yet</h2>
          {isOwner ? (
            <>
              <p>Add what the depot sells first, then record deliveries of it.</p>
              <Link to="/items" className="primary-link">
                Go to Items and prices
              </Link>
            </>
          ) : (
            <p>Ask the owner to add the items first.</p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      {notice && (
        <p className="notice-ok" role="status">
          {notice}
        </p>
      )}

      <form className="receive-layout" onSubmit={save} noValidate>
        <section className="form-card receive-main" aria-labelledby="arrived-title">
          <div className="receive-fields">
            <div className="field">
              <label htmlFor="delivery-date">Delivery date</label>
              {/* Rule 1: the browser's own calendar; nothing after today. */}
              <input
                id="delivery-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => {
                  setPickedDate(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="delivery-note">Note (optional)</label>
              <input id="delivery-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <h2 id="arrived-title">What arrived</h2>
          <div className="table-scroll">
            <table className="data-table lines-table">
              <thead>
                <tr>
                  <th scope="col">Sub-item</th>
                  <th scope="col">Quantity</th>
                  {/* Rule 2: for a shopkeeper this column does not exist at all. */}
                  {isOwner && (
                    <th scope="col">
                      Buying price each (TSh) <span className="chip">Owner only</span>
                    </th>
                  )}
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const invalid = error?.line === index;
                  return (
                    <tr key={line.key} className={invalid ? 'line-error' : undefined}>
                      <td data-label="Sub-item">
                        <label className="sr-only" htmlFor={`product-${line.key}`}>
                          Sub-item, line {index + 1}
                        </label>
                        <select
                          id={`product-${line.key}`}
                          value={line.productId}
                          aria-invalid={invalid}
                          onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                        >
                          <option value="">Choose…</option>
                          {[...byGroup.entries()].map(([group, items]) => (
                            <optgroup key={group} label={group}>
                              {items.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td data-label="Quantity">
                        <label className="sr-only" htmlFor={`quantity-${line.key}`}>
                          Quantity, line {index + 1}
                        </label>
                        <input
                          id={`quantity-${line.key}`}
                          className="small-input"
                          inputMode="numeric"
                          value={line.quantity}
                          aria-invalid={invalid}
                          onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        />
                      </td>
                      {isOwner && (
                        <td data-label="Buying price each (TSh)">
                          <label className="sr-only" htmlFor={`buying-${line.key}`}>
                            Buying price, line {index + 1}
                          </label>
                          <input
                            id={`buying-${line.key}`}
                            className="small-input"
                            inputMode="numeric"
                            placeholder="Not known"
                            value={line.buyingPrice}
                            onChange={(e) => updateLine(line.key, { buyingPrice: e.target.value })}
                          />
                        </td>
                      )}
                      <td className="number">
                        <button
                          type="button"
                          className="remove-button"
                          aria-label={`Remove line ${index + 1}`}
                          disabled={lines.length === 1}
                          onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                        >
                          <Icon name="closeCircle" size={22} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="dashed-button"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            + Add another line
          </button>
        </section>

        <aside className="receive-side">
          <section className="strong-card" aria-labelledby="after-title">
            <h2 id="after-title">Stock after saving</h2>
            {arriving.size === 0 ? (
              <p className="strong-muted">Choose sub-items and quantities to see the new stock.</p>
            ) : (
              <ul className="preview-list">
                {[...arriving.entries()].map(([id, units]) => {
                  const product = productById.get(id);
                  if (!product) return null;
                  return (
                    <li key={id} className="preview-row">
                      <span>{product.name}</span>
                      <span>
                        <span className="strong-muted">{product.quantity_in_store} → </span>
                        <strong>{product.quantity_in_store + units}</strong>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="preview-total">
              <span className="strong-muted">Units arriving</span>
              <strong>{unitsArriving}</strong>
            </div>
            {error && (
              <p className="confirm-error" role="alert">
                {error.message}
              </p>
            )}
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving…' : 'Save delivery'}
            </button>
            <p className="strong-muted small-center">All lines are saved together, or none.</p>
          </section>

          <Panel
            title="Last deliveries"
            link={{ to: '/restock', label: 'Restock history' }}
            loading={deliveries.loading}
            error={deliveries.error}
            onRetry={deliveries.reload}
          >
            {(deliveries.data ?? []).length === 0 ? (
              <EmptyState message="No deliveries yet." />
            ) : (
              <ul className="history-list">
                {(deliveries.data ?? []).slice(0, LAST_DELIVERIES).map((delivery) => (
                  <li key={delivery.id} className="history-row">
                    <span className="history-what">
                      <strong>{shortDate(delivery.delivered_at)}</strong>
                      <span>{delivery.received_by}</span>
                    </span>
                    <span className="history-price">
                      {delivery.items.length} {delivery.items.length === 1 ? 'line' : 'lines'} · {unitsOf(delivery)}{' '}
                      units
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </form>
    </>
  );
}
