// New sale: pick sub-items, see totals instantly, choose how the customer paid, confirm.
// Spec: docs/specs/f05-sale.md. The screen PREVIEWS totals; the server decides every price
// and total and re-checks the stock. The request carries only product ids and quantities.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { ApiError, apiPost } from '../api';
import {
  addProduct, checkLine, clearBill, loadBill, previewTotal, removeLine, saveBill, setQuantity, stepQuantity,
  type BillLine,
} from '../bill';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { formatTsh } from '../format';
import type { Product, Receipt } from '../types';
import { errorMessage, useApi } from '../useApi';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

type Payment = 'cash' | 'mobile_money';

export default function Sale() {
  const navigate = useNavigate();
  const products = useApi<Product[]>('/products'); // active sub-items, with price and stock

  const [bill, setBill] = useState<BillLine[]>(() => loadBill()); // rule 10: kept for this tab
  const [payment, setPayment] = useState<Payment | null>(null); // rule 6: must be chosen
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<Map<number, string>>(new Map()); // from a 409
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => saveBill(bill), [bill]);

  const productList = products.data ?? [];
  const productById = new Map(productList.map((p) => [p.id, p]));

  /**
   * Change the bill, and forget old messages about the line that changed.
   * `update` receives the CURRENT bill (React's updater form), so fast clicks never work on a
   * stale copy: with setBill(addProduct(bill, id)) two quick clicks could overwrite each other.
   */
  function changeBill(update: (current: BillLine[]) => BillLine[], productId?: number) {
    setBill(update);
    setError(null);
    if (productId !== undefined) {
      setServerProblems((current) => {
        if (!current.has(productId)) return current;
        const rest = new Map(current);
        rest.delete(productId);
        return rest;
      });
    }
  }

  // Check every line against the stock on its card; a server refusal wins for its line.
  const checked = bill.map((line) => {
    const result = checkLine(line, productById.get(line.productId));
    const fromServer = serverProblems.get(line.productId);
    return fromServer ? { ...result, problem: fromServer } : result;
  });
  const total = previewTotal(checked);
  const units = checked.reduce((sum, c) => sum + (c.quantity ?? 0), 0); // for the bill head and the phone bar
  const hasProblem = checked.some((c) => c.problem !== null);

  // Rule 7: say why Confirm is not possible yet.
  let blocker: string | null = null;
  if (bill.length === 0) blocker = 'Pick items to start';
  else if (hasProblem) blocker = 'Fix the red line to confirm';
  else if (payment === null) blocker = 'Choose how the customer paid';

  async function confirm() {
    if (blocker || busy || payment === null) return;
    setBusy(true);
    setError(null);
    try {
      // Rule 1: only WHICH product and HOW MANY. Never a price, never a total.
      const receipt = await apiPost<Receipt>('/sales', {
        payment_method: payment,
        items: checked.map((c) => ({ product_id: c.line.productId, quantity: c.quantity })),
      });
      clearBill();
      // The preview total travels along only so the receipt can say if a price changed (rule 2).
      navigate(`/receipt/${receipt.id}`, { state: { previewTotal: total } });
    } catch (err) {
      const productId = err instanceof ApiError ? err.details.product_id : undefined;
      if (err instanceof ApiError && err.status === 409 && typeof productId === 'number') {
        // Rule 3: someone else sold it first. Show it on that line and fetch the new stock.
        setServerProblems((current) => new Map(current).set(productId, err.message));
        products.reload();
      } else {
        setError(errorMessage(err));
      }
      setBusy(false);
    }
  }

  // Rule 9: search the sub-item or item name; chips filter by item.
  const groups = [...new Set(productList.map((p) => p.group))];
  const term = search.trim().toLowerCase();
  const shown = productList.filter(
    (p) =>
      (groupFilter === null || p.group === groupFilter) &&
      (term === '' || p.name.toLowerCase().includes(term) || p.group.toLowerCase().includes(term)),
  );

  const header = (
    <PageHeader title="New sale" subtitle="Tap an item to add it. The server checks prices and stock again." />
  );

  if (products.loading) {
    return (
      <>
        {header}
        <Skeleton />
      </>
    );
  }
  if (products.error) {
    return (
      <>
        {header}
        <div className="panel-state">
          <p role="alert">{products.error}</p>
          <button type="button" className="pill-button" onClick={products.reload}>
            Try again
          </button>
        </div>
      </>
    );
  }

  // The header sits above both columns (R2b), so its buttons never wrap under the title.
  return (
    <>
      {header}
      <div className="sale-layout">
        <section className="sale-pick" aria-labelledby="pick-heading">
          <span id="pick-heading" className="sr-only">
            Sub-items
          </span>
          <div className="filter-row">
            <label className="sr-only" htmlFor="sale-search">
              Search items
            </label>
            <input
              id="sale-search"
              type="search"
              className="search-input"
              placeholder="Search, e.g. Fanta"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="chips" role="group" aria-label="Filter by item">
              <button type="button" className="chip-button" aria-pressed={groupFilter === null} onClick={() => setGroupFilter(null)}>
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
          </div>

          {productList.length === 0 ? (
            <EmptyState message="No items on sale yet." />
          ) : shown.length === 0 ? (
            <EmptyState message={`Nothing matches “${search}”.`} />
          ) : (
            <div className="product-grid">
              {shown.map((product) => {
                const out = product.quantity_in_store === 0;
                const billLine = bill.find((line) => line.productId === product.id);
                const inBill = billLine !== undefined;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={['product-card', inBill ? 'in-bill' : '', out ? 'out' : ''].join(' ').trim()}
                    disabled={out} // rule 3: OUT cannot be picked
                    onClick={() => changeBill((b) => addProduct(b, product.id), product.id)}
                  >
                    <span className="product-top">
                      <span className="product-group">{product.group}</span>
                      <StatusBadge status={product.stock_status} />
                    </span>
                    <span className="product-name">{product.name}</span>
                    <span className="product-bottom">
                      <strong>TSh {formatTsh(product.effective_price)}</strong>
                      <span>{product.quantity_in_store} in store</span>
                    </span>
                    {/* R3a rule 4: the card says how many are already in the bill. */}
                    {inBill && (
                      <span className="in-bill-tag">
                        <Icon name="checkCircle" size={15} />
                        {billLine.quantity} in bill
                      </span>
                    )}
                    {out && <span className="none-left">None left</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* R3a rule 2: a normal (light) card, not the dark one. id="bill": the phone bar jumps here. */}
        <aside className="bill-card bill" id="bill" aria-labelledby="bill-title">
          <div className="bill-head">
            <div>
              <h2 id="bill-title">The bill</h2>
              <p className="bill-count">
                {checked.length} {checked.length === 1 ? 'line' : 'lines'} · {units} {units === 1 ? 'unit' : 'units'}
              </p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => changeBill(() => [])}
              disabled={bill.length === 0 || busy}
            >
              Clear
            </button>
          </div>

          {bill.length === 0 ? (
            <p className="bill-note">Tap an item to add it.</p>
          ) : (
            <ul className="bill-lines">
              {checked.map((c) => {
                const name = c.product?.name ?? 'Item no longer on sale';
                const id = c.line.productId;
                return (
                  <li key={id} className={c.problem ? 'bill-line problem' : 'bill-line'}>
                    <div className="bill-line-main">
                      <span className="bill-name">
                        <strong>{name}</strong>
                        {c.product && <span>TSh {formatTsh(c.product.effective_price)} each</span>}
                      </span>
                      <span className="stepper">
                        <button
                          type="button"
                          aria-label={`One less ${name}`}
                          onClick={() => changeBill((b) => stepQuantity(b, id, -1), id)}
                        >
                          −
                        </button>
                        <label className="sr-only" htmlFor={`qty-${id}`}>
                          Quantity of {name}
                        </label>
                        <input
                          id={`qty-${id}`}
                          inputMode="numeric"
                          value={c.line.quantity}
                          aria-invalid={c.problem !== null}
                          onChange={(e) => {
                            const text = e.target.value;
                            changeBill((b) => setQuantity(b, id, text), id);
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`One more ${name}`}
                          onClick={() => changeBill((b) => stepQuantity(b, id, 1), id)}
                        >
                          +
                        </button>
                      </span>
                      <span className="bill-line-total">{c.lineTotal === null ? '–' : formatTsh(c.lineTotal)}</span>
                    </div>
                    {c.problem && (
                      <div className="bill-problem">
                        <span>{c.problem}</span>
                        <button type="button" className="text-button" onClick={() => changeBill((b) => removeLine(b, id), id)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="preview-total">
            <span className="bill-note">Total</span>
            <strong>TSh {formatTsh(total)}</strong>
          </div>

          <fieldset className="pay-choice">
            <legend>Paid with</legend>
            <div className="pay-options">
              {(['cash', 'mobile_money'] as const).map((method) => (
                <label key={method} className={payment === method ? 'pay-option chosen' : 'pay-option'}>
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={payment === method}
                    onChange={() => setPayment(method)}
                  />
                  {method === 'cash' ? (
                    <Icon name="banknote" size={22} />
                  ) : (
                    <Icon name="smartphone" size={22} />
                  )}
                  {method === 'cash' ? 'Cash' : 'Mobile money'}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="confirm-error" role="alert">
              {error}
            </p>
          )}
          {/* R3a rule 1: the button keeps its name; when it is off, the reason is the line under it,
              joined with aria-describedby so a screen reader hears both. */}
          <button
            type="button"
            className="primary-button"
            disabled={blocker !== null || busy}
            aria-describedby={blocker && !busy ? 'confirm-reason' : undefined}
            onClick={confirm}
          >
            {busy ? 'Saving…' : 'Confirm sale'}
          </button>
          {blocker && !busy && (
            <p id="confirm-reason" className="confirm-reason">
              {blocker}
            </p>
          )}
          <p className="bill-note small-center">Totals here are a preview. The server checks prices and stock again.</p>
        </aside>
      </div>

      {/* R3a rule 5: on a phone (CSS), the bill bar stays at the bottom while you pick items. */}
      {bill.length > 0 && (
        <div className="bill-bar">
          <span className="bill-bar-text">
            <span>
              {units} {units === 1 ? 'unit' : 'units'} · {checked.length} {checked.length === 1 ? 'line' : 'lines'}
            </span>
            <strong>TSh {formatTsh(total)}</strong>
          </span>
          <a href="#bill" className="bill-bar-link">
            View bill
          </a>
        </div>
      )}
    </>
  );
}
