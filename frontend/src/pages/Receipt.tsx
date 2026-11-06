// The receipt for one sale, loaded from the server by its address (/receipt/42),
// so a refresh shows it again. Every number here is the server's. Spec: docs/specs/f05-sale.md.
import { Link, useLocation, useParams } from 'react-router';

import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { formatTsh, PAYMENT_LABEL, shortDate, timeOf } from '../format';
import type { Receipt as ReceiptData } from '../types';
import { useApi } from '../useApi';
import Skeleton from '../components/Skeleton';

export default function Receipt() {
  const { saleId } = useParams();
  const location = useLocation();
  const receipt = useApi<ReceiptData>(`/sales/${saleId}`);

  // The preview total from the sale screen (only right after confirming; gone after a refresh).
  const preview = (location.state as { previewTotal?: number } | null)?.previewTotal;

  if (receipt.loading) {
    return <Skeleton lines={5} label="Loading the receipt…" />;
  }
  if (receipt.error || !receipt.data) {
    return (
      <>
        <PageHeader title="Receipt not found" tabTitle="Receipt" />
        <p className="coming-soon">
          {receipt.error ?? 'This receipt does not exist.'} <Link to="/sale">New sale</Link>
        </p>
      </>
    );
  }

  const data = receipt.data;
  // Rule 2: the server used a different price than the screen showed. Say so honestly.
  const priceChanged = preview !== undefined && preview !== data.total;

  // R3a rule 7: the shared header row like every page; the success message is a glass card.
  return (
    <>
      <PageHeader title="Receipt" subtitle="Saved. A receipt is never changed or deleted." />
      <div className="receipt-layout">
        <section className="receipt-done" aria-labelledby="done-title">
          <div className="done-head">
            <span className="done-mark" aria-hidden="true">
              <Icon name="checkCircle" size={30} />
            </span>
            <div>
              <h2 id="done-title">Asante! Sale done.</h2>
              <p className="done-note">
                Receipt #{data.id} is saved. Stock went down for every item on this bill. The prices are kept on the
                receipt, even if they change later.
              </p>
            </div>
          </div>
          {priceChanged && (
            <p className="notice-ok" role="status">
              A price changed since the sale screen was opened. This receipt shows the price used.
            </p>
          )}
          <div className="receipt-actions">
            <Link to="/sale" className="big-button">
              <span className="big-button-icon" aria-hidden="true">
                <Icon name="addCircle" size={22} />
              </span>
              <span className="big-button-title">Next customer</span>
            </Link>
            <Link to="/" className="ghost-link">
              Done
            </Link>
          </div>
        </section>

        <article className="receipt-card" aria-labelledby="receipt-title">
          <div className="receipt-head">
            <div>
              <h2 id="receipt-title">Receipt #{data.id}</h2>
              <span className="form-lead">Depot sales receipt</span>
            </div>
            <span className="chip">{PAYMENT_LABEL[data.payment_method]}</span>
          </div>
          <dl className="receipt-facts">
            <div>
              <dt>Date and time</dt>
              <dd>
                {shortDate(data.sold_at.slice(0, 10))} {data.sold_at.slice(0, 4)}, {timeOf(data.sold_at)}
              </dd>
            </div>
            <div>
              <dt>Sold by</dt>
              <dd>{data.sold_by}</dd>
            </div>
          </dl>
          <table className="data-table receipt-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="number">
                  Qty
                </th>
                <th scope="col" className="number">
                  Price
                </th>
                <th scope="col" className="number">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((line) => (
                <tr key={line.product_id}>
                  <td>{line.product}</td>
                  <td className="number">{line.quantity}</td>
                  <td className="number">{formatTsh(line.unit_price)}</td>
                  <td className="number strong-number">{formatTsh(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="receipt-total">
            <span>Total (TSh)</span>
            <strong>{formatTsh(data.total)}</strong>
          </div>
        </article>
      </div>
    </>
  );
}
