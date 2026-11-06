// Home: a dashboard of today. Greeting, the main actions, today's numbers, the latest
// sales and what needs restocking. The owner also sees the money taken today.
// Specs: docs/specs/f04-home.md (what it shows), docs/specs/r01-redesign.md section 11 (the look).
import { ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import StockHealth from '../components/StockHealth';
import StatusBadge from '../components/StatusBadge';
import { daysAgo, formatTsh, itemsSummary, longDate, PAYMENT_LABEL, shortDate, timeOf } from '../format';
import type { Receipt, StockLine, Summary } from '../types';
import { useApi } from '../useApi';
import { useCurrentUser } from '../user';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const LATEST_SALES = 5;

export default function Home() {
  const user = useCurrentUser();
  const isOwner = user.role === 'owner';

  const summary = useApi<Summary>('/summary/today');
  const low = useApi<StockLine[]>('/stock/low');
  const stock = useApi<StockLine[]>('/stock'); // for the stock-health ring (light pass)
  // Rule 1: "today" is the server's date, so wait for the summary before asking for sales.
  const sales = useApi<Receipt[]>(summary.data ? `/sales?day=${summary.data.date}` : null);

  function refreshAll() {
    summary.reload();
    stock.reload();
    low.reload();
    sales.reload();
  }

  return (
    <>
      <PageHeader
        title={
          <>
            Habari, <span className="accent-text">{user.fullName}</span>
          </>
        }
        subtitle={summary.data ? `${longDate(summary.data.date)} · here is today so far` : 'Here is today so far'}
        tabTitle="Home"
        actions={
          <button type="button" className="icon-button" aria-label="Refresh" title="Refresh" onClick={refreshAll}>
            <RefreshCw size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        }
      />

      {/* The main actions. "New sale" lives here, not in the menu. */}
      <nav className="pill-row" aria-label="Quick actions">
        <Link to="/sale" className="action-pill main">
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          New sale
        </Link>
        <Link to="/receive" className="action-pill">
          Receive stock
        </Link>
        <Link to="/stock" className="action-pill">
          Store balance
        </Link>
      </nav>

      <TodayCards
        summary={summary.data}
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        receipts={sales.data}
        low={low.data}
      />

      <div className="home-panels">
        <Panel title="Stock health" loading={stock.loading} error={stock.error} onRetry={stock.reload}>
          <StockHealth lines={stock.data ?? []} />
        </Panel>

        <Panel
          title="Latest sales"
          link={{ to: '/sales', label: 'See all' }}
          // The sales list waits for the summary's date; show the summary's problem if it failed.
          loading={summary.error ? false : summary.loading || sales.loading}
          error={summary.error ?? sales.error}
          onRetry={summary.error ? summary.reload : sales.reload}
        >
          <LatestSales receipts={(sales.data ?? []).slice(0, LATEST_SALES)} />
        </Panel>

        <Panel
          title={isOwner ? 'Needs restocking' : 'Tell the owner: running low'}
          link={{ to: '/stock', label: 'Store balance', icon: <ArrowUpRight size={16} aria-hidden="true" /> }}
          loading={low.loading}
          error={low.error}
          onRetry={low.reload}
        >
          <LowStockTiles lines={low.data ?? []} />
        </Panel>
      </div>
    </>
  );
}

type CardsProps = {
  summary: Summary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  receipts: Receipt[] | null; // for "From 38 receipts"
  low: StockLine[] | null; // for "1 out, 2 running low"
};

function TodayCards({ summary, loading, error, onRetry, receipts, low }: CardsProps) {
  if (loading) {
    return <Skeleton label="Loading today's numbers…" />;
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
  const receiptNote = receipts ? `From ${receipts.length} ${receipts.length === 1 ? 'receipt' : 'receipts'}` : 'Money taken today';
  const outCount = low?.filter((line) => line.stock_status === 'OUT').length ?? 0;
  const lowCount = (low?.length ?? 0) - outCount;
  const lowNote = low ? `${outCount} out, ${lowCount} running low` : 'See the list below';

  return (
    <section className="stat-grid" aria-label="Today in numbers">
      {hasMoney && (
        <StatCard
          label="Sales today"
          value={`TSh ${formatTsh(summary.sales_total ?? 0)}`}
          pill="Owner only"
          note={receiptNote}
          strong
        />
      )}
      <StatCard label="Items sold" value={String(summary.items_sold)} pill="Units" note="On all receipts today" />
      <StatCard label="Low or out" value={String(summary.low_stock_count)} note={lowNote} />
      <StatCard
        label="Last restock"
        value={summary.last_restock ? shortDate(summary.last_restock) : 'None yet'}
        pill={summary.last_restock ? daysAgo(summary.last_restock, summary.date) : undefined}
        note="Latest delivery"
      />
    </section>
  );
}

function LowStockTiles({ lines }: { lines: StockLine[] }) {
  if (lines.length === 0) return <EmptyState message="Nothing is low or out." />;
  return (
    <ul className="low-tiles">
      {lines.map((line) => (
        <li key={line.product_id} className="low-tile">
          <StatusBadge status={line.stock_status} />
          <strong>{line.product}</strong>
          <span>
            {line.quantity_in_store} left{line.stock_status === 'LOW' ? ` · low at ${line.min_level}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LatestSales({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return <EmptyState message="No sales yet today." action={{ to: '/sale', label: 'New sale' }} />;
  return (
    <ul className="sale-list">
      {receipts.map((receipt) => {
        const items = itemsSummary(receipt.items);
        return (
          <li key={receipt.id} className="sale-row">
            <span className="time-tile">{timeOf(receipt.sold_at)}</span>
            <span className="sale-what">
              <strong className="cut" title={items}>
                {items}
              </strong>
              <span className="sale-meta">
                <span>#{receipt.id}</span> · <span>{receipt.sold_by}</span> ·{' '}
                <span>{PAYMENT_LABEL[receipt.payment_method]}</span>
              </span>
            </span>
            <span className="sale-total">
              TSh <span>{formatTsh(receipt.total)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
