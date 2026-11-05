// OUT / LOW / OK. The word is always written, so the color is never the only signal.
import type { StockStatus } from '../types';

export default function StatusBadge({ status }: { status: StockStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}
