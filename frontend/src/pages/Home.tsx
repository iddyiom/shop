// Home: the greeting and the big New sale button. The numbers come in unit F4.
import { Link } from 'react-router';

import PageHeader, { ComingSoon } from '../components/PageHeader';
import { useCurrentUser } from '../user';

export default function Home() {
  const user = useCurrentUser();

  return (
    <>
      <div className="home-top">
        <PageHeader eyebrow="HOME" title={`Habari, ${user.fullName}`} tabTitle="Home" />
        {/* "New sale" lives here, not in the menu (decided in the redesign). */}
        <Link to="/sale" className="big-button">
          <span className="big-button-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="big-button-text">
            <span className="big-button-title">New sale</span>
            <span className="big-button-hint">Pick items, totals appear instantly</span>
          </span>
        </Link>
      </div>
      <ComingSoon unit="F4" />
    </>
  );
}
