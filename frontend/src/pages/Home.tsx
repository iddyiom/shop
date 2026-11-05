// Home: today's numbers, what needs restocking, and the latest sales.
// Spec: docs/specs/f04-home.md. The owner also sees the money taken today.
import { Link } from 'react-router';

import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { formatTsh, itemsSummary, PAYMENT_LABEL, shortDate, timeOf } from '../format';
import type { Receipt, StockLine, Summary } from '../types';
import { useApi } from '../useApi';
import { useCurrentUser } from '../user';

const LATEST_SALES = 5;

export default function Home() {
  const user = useCurrentUser();
  const isOwner = user.role === 'owner';

  const summary = useApi<Summary>('/summary/today');
  const low = useApi<StockLine[]>('/stock/low');
  // Rule 1: "today" is the server's date, so wait for the summary before asking for sales.
  const sales = useApi<Receipt[]>(summary.data ? `/sales?day=${summary.data.date}` : null);

  function refreshAll() {
    summary.reload();
    low.reload();
    sales.reload();
  }

  return (
    <>
      <div className="home-top">
        <PageHeader eyebrow="HOME" title={`Habari, ${user.fullName}`} tabTitle="Home" />
        {/* "New sale" lives here, not in the menu (decided in the redesign). */}
        <Link to="/sale" className="big-button">
          <span className="big-button-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="big-button-text">
            <span className="big-button-title">New sale</span>
            <span className="big-button-hint">Pick items, totals appear instantly</span>
          </span>
        </Link>
      </div>

      <div className="toolbar">
        <span className="eyebrow">{summary.data ? `TODAY · ${shortDate(summary.data.date)}` : 'TODAY'}</span>
        <button type="button" className="pill-button" onClick={refreshAll}>
          Refresh
        </button>
      </div>

      <TodayCards summary={summary.data} loading={summary.loading} error={summary.error} onRetry={summary.reload} />

      <div className="panels">
        <Panel
          title={isOwner ? 'Needs restocking' : 'Tell the owner: running low'}
          link={{ to: '/stock', label: 'Store balance' }}
          loading={low.loading}
          error={low.error}
          onRetry={low.reload}
        >
          <LowStockList lines={low.data ?? []} />
        </Panel>

        <Panel
          title="Latest sales"
          link={{ to: '/sales', label: 'All sales' }}
          // The sales list waits for the summary's date; show the summary's problem if it failed.
          loading={summary.error ? false : summary.loading || sales.loading}
          error={summary.error ?? sales.error}
          onRetry={summary.error ? summary.reload : sales.reload}
        >
          <LatestSales receipts={(sales.data ?? []).slice(0, LATEST_SALES)} />
        </Panel>
      </div>
    </>
  );
}

function TodayCards(props: { summary: Summary | null; loading: boolean; error: string | null; onRetry: () => void }) {
  const { summary, loading, error, onRetry } = props;
  if (loading) {
    return (
      <p className="panel-state" role="status">
        Loading today&apos;s numbers…
      </p>
    );
  }
  if (error || !summary) {
    return (
      <div className="panel-state">
        <p role="alert">{error}</p>
        <button type="button" className="pill-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  // Rule 4: the money card exists only if the API sent sales_total (owners only).
  const hasMoney = summary.sales_total !== undefined;
  return (
    <section className="stat-grid" aria-label="Today in numbers">
      {hasMoney && (
        <StatCard label="SALES TODAY (TSh)" value={formatTsh(summary.sales_total ?? 0)} note="Owner only" strong />
      )}
      <StatCard label="ITEMS SOLD TODAY" value={String(summary.items_sold)} note="Units on all receipts" strong={!hasMoney} />
      <StatCard label="LOW OR OUT" value={String(summary.low_stock_count)} note="See the list below" />
      <StatCard
        label="LAST RESTOCK"
        value={summary.last_restock ? shortDate(summary.last_restock) : 'None yet'}
        note="Latest delivery date"
      />
    </section>
  );
}

function LowStockList({ lines }: { lines: StockLine[] }) {
  if (lines.length === 0) return <p className="empty-text">Nothing is low or out.</p>;
  return (
    <ul className="low-list">
      {lines.map((line) => (
        <li key={line.product_id} className="low-row">
          <StatusBadge status={line.stock_status} />
          <span className="low-name">
            <strong>{line.product}</strong>
            <span>{line.group}</span>
          </span>
          <span className="low-left">
            {line.quantity_in_store} left{line.stock_status === 'LOW' ? ` · low at ${line.min_level}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LatestSales({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return <p className="empty-text">No sales yet today.</p>;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Sold by</th>
            <th scope="col">Items</th>
            <th scope="col">Paid</th>
            <th scope="col" className="number">
              Total (TSh)
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => {
            const items = itemsSummary(receipt.items);
            return (
              <tr key={receipt.id}>
                <td>{timeOf(receipt.sold_at)}</td>
                <td>{receipt.sold_by}</td>
                <td className="cut" title={items}>
                  {items}
                </td>
                <td>
                  <span className="chip">{PAYMENT_LABEL[receipt.payment_method]}</span>
                </td>
                <td className="number strong-number">{formatTsh(receipt.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
