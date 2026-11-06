// Adjust stock (owner only): fix the count with a reason. Each save is a new history line;
// nothing is ever edited. Spec: docs/specs/f07-stock.md, rules 4-8 and 11.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError, apiPost } from '../api';
import PageHeader from '../components/PageHeader';
import { parseQuantity } from '../money';
import type { Adjustment, StockLine } from '../types';
import { errorMessage, useApi } from '../useApi';
import Skeleton from '../components/Skeleton';

type Direction = 'add' | 'remove';
const REASONS = ['Damaged', 'Expired', 'Lost or missing', 'Counted differently'] as const;
type Reason = (typeof REASONS)[number];
// Rule 4: these three can only take stock away (same list as the API, app/schemas.py).
const REMOVE_ONLY: Reason[] = ['Damaged', 'Expired', 'Lost or missing'];

export default function Adjust() {
  const productId = Number(useParams().productId);
  const navigate = useNavigate();
  // Stopped sub-items too: expired stock of a stopped product must still leave (rule 2).
  const stock = useApi<StockLine[]>('/stock?include_stopped=true');
  const line = stock.data?.find((l) => l.product_id === productId) ?? null;

  const [direction, setDirection] = useState<Direction | null>(null);
  const [quantityText, setQuantityText] = useState('');
  const [reason, setReason] = useState<Reason | null>(null); // question 2: must be chosen
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function chooseDirection(next: Direction) {
    setDirection(next);
    // Switching to Add drops a reason that can only remove.
    if (next === 'add' && reason !== null && REMOVE_ONLY.includes(reason)) setReason(null);
    setError(null);
  }

  // ---------- Quick checks (rule 6) and the preview (rule 7) ----------
  const quantity = parseQuantity(quantityText);
  const before = line?.quantity_in_store ?? 0;
  let blocker: string | null = null; // the first thing still missing, shown on the button
  if (direction === null) blocker = 'Choose add or remove';
  else if (!quantity.ok) blocker = quantityText.trim() === '' ? 'Enter how many' : 'Fix the quantity';
  else if (direction === 'remove' && quantity.value > before) blocker = `Only ${before} in store`;
  else if (reason === null) blocker = 'Choose a reason';
  const after =
    direction !== null && quantity.ok ? (direction === 'add' ? before + quantity.value : before - quantity.value) : null;

  async function save() {
    if (blocker !== null || busy || direction === null || reason === null || !quantity.ok) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await apiPost<Adjustment>(`/products/${productId}/adjustments`, {
        direction,
        quantity: quantity.value,
        reason,
      });
      // Rule 7 and question 3: the note uses the SERVER's numbers, then back to the list.
      navigate('/stock', { state: { notice: `${saved.product}: ${saved.before} → ${saved.after} (${saved.reason})` } });
    } catch (err) {
      setError(errorMessage(err));
      // Rule 6: the stock changed meanwhile (e.g. a sale); show the real number now.
      if (err instanceof ApiError && err.status === 409) stock.reload();
      setBusy(false);
    }
  }

  const header = <PageHeader title="Adjust stock" subtitle="Fix the count. Never edited, only added." />;
  const back = (
    <Link to="/stock" className="back-link">
      ← Back to store balance
    </Link>
  );

  if (stock.loading && !line) {
    return (
      <>
        {back}
        {header}
        <Skeleton />
      </>
    );
  }
  if (stock.error && !line) {
    return (
      <>
        {back}
        {header}
        <div className="panel-state">
          <p role="alert">{stock.error}</p>
          <button type="button" className="pill-button" onClick={stock.reload}>
            Try again
          </button>
        </div>
      </>
    );
  }
  if (!line) {
    return (
      <>
        {back}
        {header}
        <div className="empty-card">
          <h2>Sub-item not found</h2>
          <p>Go back to the store balance and choose it from the list.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {back}
      {header}
      <div className="adjust-layout">
        <section className="form-card adjust-main" aria-label={`Adjust ${line.product}`}>
          <h2>
            {line.product} <span className="muted-text">({line.group})</span>
            {!line.is_active && <span className="state-tag off">Stopped</span>}
          </h2>

          <fieldset className="adjust-step">
            <legend>1. Add or remove?</legend>
            <div className="choice-grid two">
              {(['remove', 'add'] as const).map((d) => (
                <label key={d} className={direction === d ? 'choice-tile chosen' : 'choice-tile'}>
                  <input
                    type="radio"
                    name="direction"
                    value={d}
                    checked={direction === d}
                    onChange={() => chooseDirection(d)}
                  />
                  {d === 'remove' ? '− Remove' : '+ Add'}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="adjust-step field">
            <label htmlFor="adjust-quantity" className="step-label">
              2. How many?
            </label>
            <input
              id="adjust-quantity"
              className="small-input"
              inputMode="numeric"
              value={quantityText}
              onChange={(e) => {
                setQuantityText(e.target.value);
                setError(null);
              }}
            />
            {quantityText.trim() !== '' && !quantity.ok && (
              <p className="form-message" role="alert">
                {quantity.error.charAt(0).toUpperCase() + quantity.error.slice(1)}
              </p>
            )}
          </div>

          <fieldset className="adjust-step">
            <legend>3. Why?</legend>
            <div className="choice-grid">
              {REASONS.map((r) => {
                const locked = direction === 'add' && REMOVE_ONLY.includes(r); // rule 4
                const classes = ['choice-tile', reason === r ? 'chosen' : '', locked ? 'locked' : ''].join(' ').trim();
                return (
                  <label key={r} className={classes}>
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      disabled={locked}
                      onChange={() => {
                        setReason(r);
                        setError(null);
                      }}
                    />
                    <span>
                      {r}
                      {locked && <span className="tile-note">Can only remove</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        <aside className="strong-card adjust-side" aria-labelledby="adjust-preview-title">
          <h2 id="adjust-preview-title">After saving</h2>
          <div className="preview-row">
            <span>In store now</span>
            <strong>{before}</strong>
          </div>
          <div className="preview-total">
            <span className="strong-muted">After</span>
            <strong aria-label="After">{after ?? '–'}</strong>
          </div>
          {error && (
            <p className="confirm-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="primary-button" disabled={blocker !== null || busy} onClick={save}>
            {busy ? 'Saving…' : blocker ?? 'Save adjustment'}
          </button>
          <p className="strong-muted small-center">This is a preview. The server checks the stock again.</p>
        </aside>
      </div>
    </>
  );
}
