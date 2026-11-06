// A titled card that handles its own loading and error states, so one failed call
// never blanks the whole page.
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import Skeleton from './Skeleton';

type Props = {
  title: string;
  link?: { to: string; label: string; icon?: ReactNode };
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode; // shown only when loaded without error
};

export default function Panel({ title, link, loading, error, onRetry, children }: Props) {
  const titleId = useId(); // a unique id so the section is announced by its title

  return (
    <section className="panel" aria-labelledby={titleId}>
      <div className="panel-head">
        <h2 id={titleId}>{title}</h2>
        {/* A link with an icon is a round button (its name in aria-label); otherwise a small pill. */}
        {link &&
          (link.icon ? (
            <Link to={link.to} className="icon-button" aria-label={link.label} title={link.label}>
              {link.icon}
            </Link>
          ) : (
            <Link to={link.to} className="link-pill">
              {link.label}
            </Link>
          ))}
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="panel-state">
          <p role="alert">{error}</p>
          <button type="button" className="pill-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
