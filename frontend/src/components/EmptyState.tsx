// When a list has nothing in it yet (R2b): an icon, one sentence, and the next step if there
// is one. "No sales yet today" is more useful with a "New sale" button right under it.
import { Inbox } from 'lucide-react';
import { Link } from 'react-router';

type Props = {
  message: string; // the same sentence the page always showed, e.g. "No sales yet today."
  action?: { to: string; label: string }; // e.g. { to: '/sale', label: 'New sale' }
};

export default function EmptyState({ message, action }: Props) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <Inbox size={20} strokeWidth={1.8} />
      </span>
      <p className="empty-text">{message}</p>
      {action && (
        <Link to={action.to} className="text-link">
          {action.label}
        </Link>
      )}
    </div>
  );
}
