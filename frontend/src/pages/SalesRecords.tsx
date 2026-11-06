// Sales records: every receipt of one day, for everyone. The owner also sees the day's total.
// Spec: docs/specs/f09-records.md. Receipts are never changed here, only read.
import { Link, useSearchParams } from 'react-router';

import PageHeader from '../components/PageHeader';
import { dayBefore, formatTsh, itemsSummary, longDate, PAYMENT_LABEL, timeOf } from '../format';
import type { Receipt, Summary } from '../types';
import { useApi } from '../useApi';
import { useCurrentUser } from '../user';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function SalesRecords() {
  const isOwner = useCurrentUser().role === 'owner';
  const [searchParams, setSearchParams] = useSearchParams();

  // Rule 1: "today" is the server's date, never the laptop's clock.
  const summary = useApi<Summary>('/summary/today');
  const today = summary.data?.date ?? null;
  const yesterday = today ? dayBefore(today) : null;

  // The chosen day lives in the address (?day=...), so Refresh and Back keep it.
  const asked = searchParams.get('day');
  const day = asked ?? today;
  // Rule 2: a broken or future day is never sent to the API. ("2026-11-06" > "2026-11-05" as text, too.)
  const dayOk = day !== null && today !== null && DAY_PATTERN.test(day) && day <= today;
  const sales = useApi<Receipt[]>(dayOk ? `/sales?day=${day}` : null);

  function choose(next: string) {
    // Today is the default, so it needs no ?day= in the address.
    setSearchParams(next === today ? {} : { day: next });
  }

  const receipts = sales.data ?? [];
  // Question 2: adds up the totals the SERVER put on its own receipts; owner only (rule 3).
  const dayTotal = receipts.reduce((sum, receipt) => sum + receipt.total, 0);

  const header = (
    <PageHeader title="Sales records" subtitle="Every receipt, by day. Receipts are never changed or deleted." />
  );

  if (summary.loading || summary.error) {
    return (
      <>
        {header}
        {summary.loading ? (
          <Skeleton />
        ) : (
          <div className="panel-state">
            <p role="alert">{summary.error}</p>
            <button type="button" className="pill-button" onClick={summary.reload}>
              Try again
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <div className="filter-row">
        <div className="chips" role="group" aria-label="Choose a day">
          <button
            type="button"
            className="chip-button"
            aria-pressed={day === today}
            onClick={() => today && choose(today)}
          >
            Today
          </button>
          <button
            type="button"
            className="chip-button"
            aria-pressed={day === yesterday}
            onClick={() => yesterday && choose(yesterday)}
          >
            Yesterday
          </button>
        </div>
        <label className="sr-only" htmlFor="sales-day">
          Pick a date
        </label>
        {/* The browser's own calendar; nothing after today. */}
        <input
          id="sales-day"
          type="date"
          className="date-pill"
          value={dayOk && day ? day : ''}
          max={today ?? undefined}
          onChange={(e) => e.target.value && choose(e.target.value)}
        />
      </div>

      {!dayOk ? (
        <p className="form-message" role="alert">
          Pick today or an earlier day.
        </p>
      ) : (
        <section className="panel" aria-labelledby="day-title">
          <div className="day-card">
            <div>
              <h2 id="day-title">{longDate(day)}</h2>
              {!sales.loading && !sales.error && (
                <span className="muted-text">
                  {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}
                </span>
              )}
            </div>
            {isOwner && !sales.loading && !sales.error && (
              <div className="day-total">
                <span className="chip">Owner only</span>
                <strong aria-label="Day total">TSh {formatTsh(dayTotal)}</strong>
              </div>
            )}
          </div>

          {sales.loading ? (
            <Skeleton />
          ) : sales.error ? (
            <div className="panel-state">
              <p role="alert">{sales.error}</p>
              <button type="button" className="pill-button" onClick={sales.reload}>
                Try again
              </button>
            </div>
          ) : receipts.length === 0 ? (
            <EmptyState message="No sales on this day." action={{ to: '/sale', label: 'New sale' }} />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Time</th>
                    <th scope="col">Items</th>
                    <th scope="col" className="phone-hide">
                      Sold by
                    </th>
                    <th scope="col" className="phone-hide">
                      Paid with
                    </th>
                    <th scope="col" className="number">
                      Total (TSh)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td data-label="Receipt">
                        <Link to={`/receipt/${receipt.id}`} aria-label={`Receipt #${receipt.id}`}>
                          #{receipt.id}
                        </Link>
                      </td>
                      <td data-label="Time">{timeOf(receipt.sold_at)}</td>
                      <td className="cut" title={itemsSummary(receipt.items)} data-label="Items">
                        {itemsSummary(receipt.items)}
                      </td>
                      <td className="phone-hide" data-label="Sold by">
                        {receipt.sold_by}
                      </td>
                      <td className="phone-hide" data-label="Paid with">
                        {PAYMENT_LABEL[receipt.payment_method]}
                      </td>
                      <td className="number strong-number" data-label="Total (TSh)">
                        {formatTsh(receipt.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="empty-text small-note">Receipts cannot be changed or deleted.</p>
        </section>
      )}
    </>
  );
}
