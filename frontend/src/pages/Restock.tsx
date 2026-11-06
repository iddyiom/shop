// Restock history: every delivery, newest first, for everyone. The owner also sees buying prices
// and can correct a line. A delivery is never edited: a correction is a new entry under it.
// Spec: docs/specs/f09-records.md.
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError, apiPost } from '../api';
import PageHeader from '../components/PageHeader';
import { formatTsh, longDate, shortDate, signed, timeOf } from '../format';
import { parseQuantity } from '../money';
import type { Correction, Delivery } from '../types';
import { errorMessage, useApi } from '../useApi';
import { useCurrentUser } from '../user';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

/** One sub-item on a delivery. The same sub-item twice on the paperwork is added together here. */
type Row = {
  productId: number;
  product: string;
  delivered: number;
  corrections: number; // the sum of its corrections (+/−)
  buyingPrices: (number | null)[]; // owner only; one per paper line
};

function rowsOf(delivery: Delivery): Row[] {
  const rows = new Map<number, Row>();
  for (const line of delivery.items) {
    const row = rows.get(line.product_id) ?? {
      productId: line.product_id, product: line.product, delivered: 0, corrections: 0, buyingPrices: [],
    };
    row.delivered += line.quantity;
    if (line.buying_price !== undefined) row.buyingPrices.push(line.buying_price);
    rows.set(line.product_id, row);
  }
  for (const fix of delivery.corrections) {
    const row = rows.get(fix.product_id);
    if (row) row.corrections += fix.quantity_change;
  }
  return [...rows.values()];
}

const unitsOf = (delivery: Delivery) => delivery.items.reduce((sum, line) => sum + line.quantity, 0);

export default function Restock() {
  const isOwner = useCurrentUser().role === 'owner';
  const { deliveryId } = useParams();

  const list = useApi<Delivery[]>('/deliveries');
  // Rule 9: no id in the address = the newest delivery. Question 3: each delivery has its own address.
  const selectedId = deliveryId ?? (list.data?.[0] ? String(list.data[0].id) : null);
  const validId = selectedId !== null && /^\d+$/.test(selectedId);
  const detail = useApi<Delivery>(validId ? `/deliveries/${selectedId}` : null);

  // The note after a correction belongs to the delivery it was made on.
  const [notice, setNotice] = useState<{ deliveryId: number; text: string } | null>(null);

  const header = <PageHeader title="Restock history" subtitle="Past deliveries, newest first. Lines are never edited." />;

  // Only the FIRST load blanks the page; a reload after a correction keeps the old list on screen.
  if (!list.data && (list.loading || list.error)) {
    return (
      <>
        {header}
        {list.loading ? (
          <Skeleton />
        ) : (
          <div className="panel-state">
            <p role="alert">{list.error}</p>
            <button type="button" className="pill-button" onClick={list.reload}>
              Try again
            </button>
          </div>
        )}
      </>
    );
  }

  const deliveries = list.data ?? [];
  if (deliveries.length === 0) {
    return (
      <>
        {header}
        <div className="empty-card">
          <h2>No deliveries yet</h2>
          <p>When the truck comes, record it in Receive stock.</p>
          <Link to="/receive" className="primary-link">
            Go to Receive stock
          </Link>
        </div>
      </>
    );
  }

  let right;
  if (!validId || detail.error) {
    right = (
      <div className="empty-card">
        <h2>Delivery not found</h2>
        <p>Choose a delivery from the list.</p>
      </div>
    );
  } else if (!detail.data || String(detail.data.id) !== selectedId) {
    // First load, or another delivery was clicked and is still on its way.
    right = (
      <Skeleton />
    );
  } else {
    const delivery = detail.data;
    right = (
      <DeliveryCard
        key={delivery.id} // a fresh correction form for each delivery
        delivery={delivery}
        isOwner={isOwner}
        notice={notice?.deliveryId === delivery.id ? notice.text : null}
        onCorrected={(text) => {
          setNotice({ deliveryId: delivery.id, text });
          detail.reload(); // show what the SERVER has now
          list.reload(); // the "corrected" tag
        }}
        onStale={detail.reload}
      />
    );
  }

  return (
    <>
      {header}
      <div className="restock-layout">
        <nav className="delivery-list" aria-label="Deliveries">
          <p className="muted-text">Newest first</p>
          {deliveries.map((delivery) => {
            const current = String(delivery.id) === selectedId;
            return (
              <Link
                key={delivery.id}
                to={`/restock/${delivery.id}`}
                className={current ? 'delivery-card selected' : 'delivery-card'}
                aria-current={current ? 'page' : undefined}
              >
                <span className="delivery-top">
                  <strong>{shortDate(delivery.delivered_at)}</strong>
                  <span>{unitsOf(delivery)} units</span>
                </span>
                <span className="muted-text">
                  {delivery.note ? `${delivery.note} · ` : ''}
                  {delivery.received_by}
                </span>
                {delivery.corrections.length > 0 && <span className="chip">Corrected</span>}
              </Link>
            );
          })}
        </nav>
        <div className="restock-main">{right}</div>
      </div>
    </>
  );
}

type CardProps = {
  delivery: Delivery;
  isOwner: boolean;
  notice: string | null;
  onCorrected: (note: string) => void;
  onStale: () => void;
};

function DeliveryCard({ delivery, isOwner, notice, onCorrected, onStale }: CardProps) {
  const rows = rowsOf(delivery);
  return (
    <>
      <section className="panel" aria-labelledby="delivery-title">
        <div className="panel-head">
          <div>
            <h2 id="delivery-title">Delivery of {longDate(delivery.delivered_at)}</h2>
            <span className="muted-text">
              {delivery.note ? `${delivery.note} · ` : ''}received by {delivery.received_by}
            </span>
          </div>
          <span className="state-tag">Never edited</span>
        </div>
        {notice && (
          <p className="notice-ok" role="status">
            {notice}
          </p>
        )}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Sub-item</th>
                <th scope="col" className="number">
                  Delivered
                </th>
                {/* On phones this column hides: every correction is listed under the table anyway. */}
                <th scope="col" className="number phone-hide">
                  Corrections
                </th>
                <th scope="col" className="number">
                  Recorded now
                </th>
                {/* Rule 5: for a shopkeeper this column does not exist at all. */}
                {isOwner && (
                  <th scope="col" className="number">
                    Buying price <span className="chip">Owner</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.productId}>
                  <td>
                    <strong>{row.product}</strong>
                  </td>
                  <td className="number" data-label="Delivered">{row.delivered}</td>
                  <td
                    className={row.corrections < 0 ? 'number phone-hide change-down' : 'number phone-hide'}
                    data-label="Corrections"
                  >
                    {row.corrections === 0 ? '—' : signed(row.corrections)}
                  </td>
                  <td className="number strong-number" data-label="Recorded now">
                    {row.delivered + row.corrections}
                  </td>
                  {isOwner && (
                    <td className="number" data-label="Buying price">
                      {row.buyingPrices.map((p) => (p === null ? '—' : formatTsh(p))).join(' / ') || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="section-label">Corrections on this delivery</h3>
        {delivery.corrections.length === 0 ? (
          <EmptyState message="No corrections." />
        ) : (
          <ul className="history-list" aria-label="Corrections on this delivery">
            {delivery.corrections.map((fix) => (
              <li key={fix.id} className="history-row">
                <span className="history-what">
                  <strong>
                    {fix.product} · “{fix.reason}”
                  </strong>
                  <span>
                    {shortDate(fix.at.slice(0, 10))} {timeOf(fix.at)} · {fix.by}
                  </span>
                </span>
                <span className={fix.quantity_change > 0 ? 'change-up' : 'change-down'}>
                  {signed(fix.quantity_change)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && <CorrectionForm delivery={delivery} rows={rows} onCorrected={onCorrected} onStale={onStale} />}
    </>
  );
}

type FormProps = {
  delivery: Delivery;
  rows: Row[];
  onCorrected: (note: string) => void;
  onStale: () => void;
};

function CorrectionForm({ delivery, rows, onCorrected, onStale }: FormProps) {
  const [productId, setProductId] = useState('');
  const [direction, setDirection] = useState<'add' | 'remove' | null>(null);
  const [quantityText, setQuantityText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const row = rows.find((r) => String(r.productId) === productId) ?? null;
  const recorded = row ? row.delivered + row.corrections : 0;
  const quantity = parseQuantity(quantityText);

  // Rule 6: the first thing still missing, shown on the button. The server checks it all again.
  let blocker: string | null = null;
  if (!row) blocker = 'Choose a sub-item';
  else if (direction === null) blocker = 'Choose add or remove';
  else if (!quantity.ok) blocker = quantityText.trim() === '' ? 'Enter how many' : 'Fix the quantity';
  else if (direction === 'remove' && quantity.value > recorded) blocker = `Only ${recorded} recorded on this delivery`;
  else if (reason.trim() === '') blocker = 'Write the reason';

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setError(null);
    };
  }

  async function save() {
    if (blocker !== null || busy || !row || direction === null || !quantity.ok) return;
    setBusy(true);
    setError(null);
    try {
      // Question 4: the screen asks Add / Remove; the API wants one signed number.
      const change = direction === 'remove' ? -quantity.value : quantity.value;
      const saved = await apiPost<Correction>(`/deliveries/${delivery.id}/corrections`, {
        product_id: row.productId,
        quantity_change: change,
        reason: reason.trim(),
      });
      // Rule 7: the note uses the SERVER's answer.
      onCorrected(
        `${saved.product}: ${signed(saved.quantity_change)} on this delivery. Stock ${saved.before} → ${saved.after}.`,
      );
      setProductId('');
      setDirection(null);
      setQuantityText('');
      setReason('');
    } catch (err) {
      setError(errorMessage(err));
      // Rule 6: the numbers changed meanwhile; show the real ones.
      if (err instanceof ApiError && err.status === 409) onStale();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-card correction-card" aria-labelledby="correct-title">
      <div className="panel-head">
        <h2 id="correct-title">Correct a line</h2>
        <span className="chip">Owner only</span>
      </div>
      <div className="field">
        <label htmlFor="correct-product">Sub-item on this delivery</label>
        <select
          id="correct-product"
          className="field-select"
          value={productId}
          onChange={(e) => edit(setProductId)(e.target.value)}
        >
          <option value="">Choose…</option>
          {rows.map((r) => (
            <option key={r.productId} value={r.productId}>
              {r.product} ({r.delivered + r.corrections} recorded)
            </option>
          ))}
        </select>
      </div>

      <fieldset className="adjust-step">
        <legend>Change</legend>
        <div className="choice-grid two">
          {(['remove', 'add'] as const).map((d) => (
            <label key={d} className={direction === d ? 'choice-tile chosen' : 'choice-tile'}>
              <input
                type="radio"
                name="correct-direction"
                value={d}
                checked={direction === d}
                onChange={() => edit(setDirection)(d)}
              />
              {d === 'remove' ? '− Remove' : '+ Add'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="correct-quantity">How many</label>
        <input
          id="correct-quantity"
          className="small-input"
          inputMode="numeric"
          value={quantityText}
          onChange={(e) => edit(setQuantityText)(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="correct-reason">Reason (required)</label>
        <input
          id="correct-reason"
          maxLength={500}
          placeholder="e.g. Counted again, truck brought 46"
          value={reason}
          onChange={(e) => edit(setReason)(e.target.value)}
        />
      </div>

      <p className="muted-text small-note">
        The delivery stays as it was. The fix is added below it, and stock changes by the same amount.
      </p>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="primary-button" disabled={blocker !== null || busy} onClick={save}>
        {busy ? 'Saving…' : blocker ?? 'Add correction'}
      </button>
    </section>
  );
}
