// Home: how healthy the store is, as a ring (light pass, the Pinterest idea).
// "7 of 9 sub-items OK" with the OK / LOW / OUT counts under it. The numbers are counted
// from the stock list the server already sends; the ring is only a picture of them.
import type { StockLine, StockStatus } from '../types';

const RADIUS = 52;
const CIRCLE = 2 * Math.PI * RADIUS; // the ring's full length

export default function StockHealth({ lines }: { lines: StockLine[] }) {
  const active = lines.filter((line) => line.is_active); // stopped sub-items are not for sale
  const counts: Record<StockStatus, number> = { OK: 0, LOW: 0, OUT: 0 };
  for (const line of active) counts[line.stock_status] += 1;
  const share = active.length === 0 ? 0 : counts.OK / active.length;

  return (
    <div className="stock-health">
      <div className="health-ring">
        {/* The ring is a picture; the same facts are written in words beside it. */}
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="health-track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="health-fill"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={`${share * CIRCLE} ${CIRCLE}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span className="health-words">
          <strong>
            {counts.OK} of {active.length}
          </strong>
          <span>sub-items OK</span>
        </span>
      </div>
      <ul className="health-counts">
        <li className="health-ok">
          <strong>{counts.OK}</strong> OK
        </li>
        <li className="health-low">
          <strong>{counts.LOW}</strong> LOW
        </li>
        <li className="health-out">
          <strong>{counts.OUT}</strong> OUT
        </li>
      </ul>
    </div>
  );
}
