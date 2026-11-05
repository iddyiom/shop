// Store balance: what is in the store, for everyone. The owner also gets Adjust buttons and
// the latest fixes to stock. Spec: docs/specs/f07-stock.md. No money on this page (rule 1).
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import { shortDate, signed, timeOf } from '../format';
import type { StockEntry, StockLine, StockStatus } from '../types';
import { useApi } from '../useApi';
import { useCurrentUser } from '../user';

const STATUSES: StockStatus[] = ['OUT', 'LOW', 'OK'];
const LATEST_FIXES = 10;

export default function Stock() {
  const isOwner = useCurrentUser().role === 'owner';
  const location = useLocation();
  const navigate = useNavigate();

  // "Fanta: 5 → 3 (Damaged)", passed by the Adjust page after saving (rule 8).
  const [notice] = useState<string | null>(() => (location.state as { notice?: string } | null)?.notice ?? null);
  useEffect(() => {
    // Forget it in the browser history, so Refresh does not show it again.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  // Question 1: one load (stopped included); every filter below works on the screen.
  const stock = useApi<StockLine[]>('/stock?include_stopped=true');
  // Rule 9: a shopkeeper never asks for the fixes (the API would answer 403).
  const fixes = useApi<StockEntry[]>(isOwner ? '/stock-entries' : null);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StockStatus | null>(null);
  const [showStopped, setShowStopped] = useState(false);

  // ---------- Filters, in steps ----------
  const all = stock.data ?? [];
  const term = search.trim().toLowerCase();
  // Step 1: stopped (rule 2), search and item chip.
  const matching = all.filter(
    (line) =>
      (showStopped || line.is_active) &&
      (groupFilter === null || line.group === groupFilter) &&
      (term === '' || line.product.toLowerCase().includes(term) || line.group.toLowerCase().includes(term)),
  );
  // Step 2: the counts come from that same list, so they always agree with the table (rule 3).
  const counts: Record<StockStatus, number> = { OUT: 0, LOW: 0, OK: 0 };
  for (const line of matching) counts[line.stock_status] += 1;
  // Step 3: a clicked count shows only that status (question 4).
  const shown = statusFilter === null ? matching : matching.filter((line) => line.stock_status === statusFilter);

  const groups = [...new Set(all.filter((l) => showStopped || l.is_active).map((l) => l.group))];

  const header = <PageHeader eyebrow="STORE BALANCE" title="What is in the store" tabTitle="Store balance" />;

  let body;
  if (stock.loading) {
    body = (
      <p className="panel-state" role="status">
        Loading…
      </p>
    );
  } else if (stock.error) {
    body = (
      <div className="panel-state">
        <p role="alert">{stock.error}</p>
        <button type="button" className="pill-button" onClick={stock.reload}>
          Try again
        </button>
      </div>
    );
  } else if (all.length === 0) {
    body = (
      <div className="empty-card">
        <h2>No items yet</h2>
        <p>{isOwner ? 'Add what the depot sells in Items and prices.' : 'Ask the owner to add the items first.'}</p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="count-row" role="group" aria-label="Show by status">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className="count-pill"
              aria-pressed={statusFilter === status}
              aria-label={`${status}: ${counts[status]}`}
              onClick={() => setStatusFilter((current) => (current === status ? null : status))}
            >
              <StatusBadge status={status} />
              <span className="count-number">{counts[status]}</span>
            </button>
          ))}
        </div>

        <div className="filter-row">
          <label className="sr-only" htmlFor="stock-search">
            Search stock
          </label>
          <input
            id="stock-search"
            type="search"
            className="search-input"
            placeholder="Search, e.g. Fanta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="chips" role="group" aria-label="Filter by item">
            <button
              type="button"
              className="chip-button"
              aria-pressed={groupFilter === null}
              onClick={() => setGroupFilter(null)}
            >
              All
            </button>
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                className="chip-button"
                aria-pressed={groupFilter === group}
                onClick={() => setGroupFilter(group)}
              >
                {group}
              </button>
            ))}
          </div>
          <label className="check-label">
            <input type="checkbox" checked={showStopped} onChange={(e) => setShowStopped(e.target.checked)} />
            Show stopped
          </label>
        </div>

        <section className="panel" aria-label="Stock table">
          {shown.length === 0 ? (
            <p className="empty-text">Nothing matches these filters.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table stock-table">
                <thead>
                  <tr>
                    <th scope="col">Sub-item</th>
                    <th scope="col" className="phone-hide">
                      Item
                    </th>
                    <th scope="col" className="number">
                      In store
                    </th>
                    <th scope="col" className="number">
                      Low at
                    </th>
                    <th scope="col">Status</th>
                    {isOwner && (
                      <th scope="col">
                        <span className="sr-only">Adjust</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((line) => (
                    <tr key={line.product_id} className={line.is_active ? undefined : 'stopped-row'}>
                      <td className="cut" title={line.product}>
                        <strong>{line.product}</strong>
                      </td>
                      <td className="phone-hide">{line.group}</td>
                      <td className="number strong-number">{line.quantity_in_store}</td>
                      <td className="number">{line.min_level}</td>
                      <td>
                        {line.is_active ? (
                          <StatusBadge status={line.stock_status} />
                        ) : (
                          <span className="state-tag off">STOPPED</span>
                        )}
                      </td>
                      {isOwner && (
                        <td className="number">
                          <Link
                            to={`/stock/${line.product_id}/adjust`}
                            className="icon-link"
                            aria-label={`Adjust ${line.product}`}
                          >
                            Adjust
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
      <div className="stock-layout">
        <div className="stock-main">{body}</div>
        {isOwner && (
          <aside className="stock-side">
            <Panel title="Fixes to stock" loading={fixes.loading} error={fixes.error} onRetry={fixes.reload}>
              <FixesList entries={fixes.data ?? []} />
            </Panel>
          </aside>
        )}
      </div>
    </>
  );
}

function FixesList({ entries }: { entries: StockEntry[] }) {
  return (
    <>
      {entries.length === 0 ? (
        <p className="empty-text">No fixes yet.</p>
      ) : (
        <ul className="history-list" aria-label="Latest fixes">
          {entries.slice(0, LATEST_FIXES).map((entry) => (
            <li key={entry.id} className="history-row">
              <span className="history-what">
                <strong>{entry.product}</strong>
                <span>
                  {entry.reason} · {entry.kind === 'correction' ? `Correction, delivery #${entry.delivery_id}` : 'Adjustment'}
                </span>
                <span>
                  {shortDate(entry.at.slice(0, 10))} {timeOf(entry.at)} · {entry.by}
                </span>
              </span>
              <span className={entry.quantity_change > 0 ? 'change-up' : 'change-down'}>
                {signed(entry.quantity_change)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* Rule 10 */}
      <p className="empty-text small-note">Never edited, only added. A wrong fix is undone by a new one.</p>
    </>
  );
}
