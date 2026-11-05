// A titled card that handles its own loading and error states, so one failed call
// never blanks the whole page.
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

type Props = {
  title: string;
  link?: { to: string; label: string };
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
        {link && <Link to={link.to}>{link.label}</Link>}
      </div>
      {loading ? (
        <p className="panel-state" role="status">
          Loading…
        </p>
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
