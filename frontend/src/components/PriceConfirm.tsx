// The confirm step before any price change: shows old → new, who is affected,
// and that old receipts keep the old price. Nothing is sent until "Yes, change".
import { formatTsh } from '../format';

type Props = {
  title: string; // e.g. "Soda: change the price?"
  oldLabel: string; // e.g. "1,000" or "Item price"
  newLabel: string;
  affects: string[]; // sub-items that will sell at the new price
  oldReceiptPrice: number | null; // what old receipts keep showing
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function PriceConfirm(props: Props) {
  const { title, oldLabel, newLabel, affects, oldReceiptPrice, busy, error, onConfirm, onCancel } = props;

  return (
    <section className="confirm-panel" aria-labelledby="confirm-title">
      <p className="confirm-eyebrow">CONFIRM PRICE CHANGE</p>
      <h2 id="confirm-title">{title}</h2>
      <div className="confirm-prices">
        <span className="confirm-old">
          <span>Old</span>
          <strong>{oldLabel}</strong>
        </span>
        <span aria-hidden="true">→</span>
        <span className="confirm-new">
          <span>New</span>
          <strong>{newLabel}</strong>
        </span>
      </div>
      {affects.length > 0 && <p className="confirm-note">Will sell at the new price: {affects.join(', ')}.</p>}
      {oldReceiptPrice !== null && (
        <p className="confirm-note">Old receipts keep TSh {formatTsh(oldReceiptPrice)}.</p>
      )}
      {error && (
        <p className="confirm-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-buttons">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Changing…' : 'Yes, change'}
        </button>
      </div>
    </section>
  );
}
