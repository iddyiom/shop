// Items and prices (owner only): every item with its sub-items, changing an item's price
// with a confirm step, and the price history. Spec: docs/specs/f08-items.md.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { apiPatch, apiPut } from '../api';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import PriceConfirm from '../components/PriceConfirm';
import { formatTsh, shortDate, timeOf } from '../format';
import { parseTsh } from '../money';
import type { Group, PriceChange, PriceHistoryEntry, Product } from '../types';
import { errorMessage, useApi } from '../useApi';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

type PriceDraft = {
  group: Group;
  text: string; // what the owner typed
  value: number | null; // set once the typed price is valid (step 2: confirm)
  error: string | null;
};

export default function Items() {
  const location = useLocation();
  const navigate = useNavigate();
  // A short "Soda added" note passed by the form pages after saving.
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  );
  useEffect(() => {
    // Forget the note in the browser history, so Back/Refresh does not show it again.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const [showStopped, setShowStopped] = useState(false);
  const query = showStopped ? '?include_stopped=true' : '';
  const groups = useApi<Group[]>(`/groups${query}`);
  const products = useApi<Product[]>(`/products${query}`);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = groups.data?.find((g) => g.id === selectedId) ?? groups.data?.[0] ?? null;
  const history = useApi<PriceHistoryEntry[]>(selected ? `/groups/${selected.id}/price-history` : null);

  const [draft, setDraft] = useState<PriceDraft | null>(null);
  const [busy, setBusy] = useState(false); // one click = one request

  function reloadAll() {
    groups.reload();
    products.reload();
    history.reload();
  }

  function subItemsOf(group: Group): Product[] {
    return (products.data ?? []).filter((p) => p.group_id === group.id);
  }

  function startPriceChange(group: Group) {
    setSelectedId(group.id);
    setNotice(null);
    setDraft({ group, text: String(group.current_price), value: null, error: null });
  }

  function continueToConfirm() {
    if (!draft) return;
    const parsed = parseTsh(draft.text);
    setDraft(parsed.ok ? { ...draft, value: parsed.value, error: null } : { ...draft, error: parsed.error });
  }

  async function confirmPrice() {
    if (!draft || draft.value === null || busy) return;
    setBusy(true);
    try {
      const answer = await apiPut<PriceChange>(`/groups/${draft.group.id}/price`, { price: draft.value });
      setNotice(
        answer.changed
          ? `Price of ${draft.group.name} changed to TSh ${formatTsh(draft.value)}`
          : `The price is already TSh ${formatTsh(draft.value)}. Nothing changed.`,
      );
      setDraft(null);
      reloadAll(); // show what the server has now, never our own guess
    } catch (error) {
      setDraft({ ...draft, error: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function bringBack(group: Group) {
    if (busy) return;
    setBusy(true);
    try {
      await apiPatch<Group>(`/groups/${group.id}`, { is_active: true });
      setNotice(`${group.name} is selling again`);
      reloadAll();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const loading = groups.loading || products.loading;
  const loadError = groups.error ?? products.error;

  return (
    <>
      <div className="home-top">
        <PageHeader
          title="Items and prices"
          subtitle="What you sell. A sub-item uses its item's price unless it has its own."
        />
        <Link to="/items/new" className="primary-link">
          + Add item
        </Link>
      </div>

      <div className="toolbar">
        <label className="check-label">
          <input type="checkbox" checked={showStopped} onChange={(e) => setShowStopped(e.target.checked)} />
          Show stopped
        </label>
      </div>

      {notice && (
        <p className="notice-ok" role="status">
          {notice}
        </p>
      )}

      {loading ? (
        <Skeleton />
      ) : loadError ? (
        <div className="panel-state">
          <p role="alert">{loadError}</p>
          <button type="button" className="pill-button" onClick={reloadAll}>
            Try again
          </button>
        </div>
      ) : (groups.data ?? []).length === 0 ? (
        <div className="empty-card">
          <h2>No items yet. Add your first item.</h2>
          <p>An item is a group like Soda or Biscuit, with one price for its sub-items.</p>
          <Link to="/items/new" className="primary-link">
            + Add item
          </Link>
        </div>
      ) : (
        <div className="items-layout">
          <section className="item-grid" aria-label="Items">
            {(groups.data ?? []).map((group) => (
              <ItemCard
                key={group.id}
                group={group}
                subItems={subItemsOf(group)}
                selected={selected?.id === group.id}
                busy={busy}
                onChangePrice={() => startPriceChange(group)}
                onShowHistory={() => {
                  setSelectedId(group.id);
                  setDraft(null);
                }}
                onBringBack={() => bringBack(group)}
              />
            ))}
          </section>

          <aside className="items-side">
            {draft && draft.value === null && (
              <section className="form-card" aria-labelledby="new-price-title">
                <h2 id="new-price-title">New price for {draft.group.name}</h2>
                <div className="field">
                  <label htmlFor="new-price">Item price (TSh)</label>
                  <input
                    id="new-price"
                    inputMode="numeric"
                    value={draft.text}
                    onChange={(e) => setDraft({ ...draft, text: e.target.value, error: null })}
                  />
                </div>
                {draft.error && (
                  <p className="form-message" role="alert">
                    {draft.error}
                  </p>
                )}
                <div className="confirm-buttons">
                  <button type="button" className="ghost-button" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                  <button type="button" className="primary-button" onClick={continueToConfirm}>
                    Continue
                  </button>
                </div>
              </section>
            )}

            {draft && draft.value !== null && (
              <PriceConfirm
                title={`${draft.group.name}: change the price?`}
                oldLabel={formatTsh(draft.group.current_price)}
                newLabel={formatTsh(draft.value)}
                affects={subItemsOf(draft.group)
                  .filter((p) => p.own_price === null && p.is_active)
                  .map((p) => p.name)}
                oldReceiptPrice={draft.group.current_price}
                busy={busy}
                error={draft.error}
                onConfirm={confirmPrice}
                onCancel={() => setDraft(null)}
              />
            )}

            {!draft && selected && (
              <Panel
                title={`${selected.name} price history`}
                loading={history.loading}
                error={history.error}
                onRetry={history.reload}
              >
                <PriceHistoryList entries={history.data ?? []} />
              </Panel>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

type CardProps = {
  group: Group;
  subItems: Product[];
  selected: boolean;
  busy: boolean;
  onChangePrice: () => void;
  onShowHistory: () => void;
  onBringBack: () => void;
};

function ItemCard({ group, subItems, selected, busy, onChangePrice, onShowHistory, onBringBack }: CardProps) {
  const classes = ['item-card', selected ? 'selected' : '', group.is_active ? '' : 'stopped'].join(' ').trim();
  return (
    <article className={classes} aria-label={group.name}>
      <div className="item-head">
        <div>
          <h2>{group.name}</h2>
          <span className="item-price-label">Item price</span>
          <span className="item-price">TSh {formatTsh(group.current_price)}</span>
        </div>
        {group.is_active ? (
          <button type="button" className="dark-button" onClick={onChangePrice}>
            Change price
          </button>
        ) : (
          <button type="button" className="dark-button" onClick={onBringBack} disabled={busy}>
            Bring back
          </button>
        )}
      </div>

      {!group.is_active && <p className="stopped-note">Stopped: none of its sub-items can be sold.</p>}

      {subItems.length === 0 ? (
        <EmptyState message="No sub-items yet." />
      ) : (
        <ul className="sub-list">
          {subItems.map((product) => (
            <li key={product.id} className={product.is_active ? 'sub-row' : 'sub-row stopped'}>
              <span className="sub-name">
                <strong>{product.name}</strong>
                <span>
                  {product.own_price === null
                    ? `Uses item price TSh ${formatTsh(group.current_price)}`
                    : `Own price TSh ${formatTsh(product.own_price)}`}
                  {` · ${product.quantity_in_store} in store`}
                </span>
              </span>
              <span className={product.is_active ? 'state-tag' : 'state-tag off'}>
                {product.is_active ? 'Selling' : 'Stopped'}
              </span>
              <Link
                to={`/items/sub-items/${product.id}/edit`}
                className="icon-link"
                aria-label={`Edit ${product.name}`}
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="item-actions">
        {group.is_active && (
          <Link to={`/items/${group.id}/new-sub-item`} className="dashed-link">
            + Add sub-item to {group.name}
          </Link>
        )}
        <Link to={`/items/${group.id}/edit`} className="text-link">
          Edit {group.name}
        </Link>
        <button type="button" className="text-button" onClick={onShowHistory}>
          Price history
        </button>
      </div>
    </article>
  );
}

function PriceHistoryList({ entries }: { entries: PriceHistoryEntry[] }) {
  if (entries.length === 0) return <EmptyState message="No price changes yet." />;
  return (
    <ul className="history-list">
      {entries.map((entry, index) => (
        <li key={`${entry.changed_at}-${index}`} className="history-row">
          <span className="history-what">
            <strong>{entry.target === 'item' ? `${entry.name} (item)` : entry.name}</strong>
            <span>
              {shortDate(entry.changed_at.slice(0, 10))} {timeOf(entry.changed_at)} · {entry.changed_by}
            </span>
          </span>
          <span className="history-price">{entry.price === null ? 'Item price' : formatTsh(entry.price)}</span>
        </li>
      ))}
    </ul>
  );
}
