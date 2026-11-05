// The frame around every page except Log in: menu on the left, top bar, page in the middle.
import { Link, Outlet } from 'react-router';

import { ROLE_LABEL, useCurrentUser } from '../user';
import ApiStatus from './ApiStatus';
import Menu from './Menu';
import ThemeSwitch from './ThemeSwitch';

export default function Layout() {
  const user = useCurrentUser();

  return (
    <div className="shell">
      {/* First thing Tab reaches: jump past the menu straight to the page. */}
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="menu" aria-label="Main menu">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">D</span>
          Depot
        </div>
        <Menu role={user.role} />
        <div className="user-card">
          <span className="user-name">{user.fullName}</span>
          <span className="user-role">{ROLE_LABEL[user.role]}</span>
          <Link to="/login" className="user-logout">
            Log out
          </Link>
        </div>
      </nav>

      <div className="workspace">
        <div className="topbar">
          <ApiStatus />
          <ThemeSwitch />
        </div>
        {/* tabIndex -1: the skip link can move keyboard focus here */}
        <main id="main" className="page" tabIndex={-1}>
          <Outlet /> {/* the page for the current address */}
        </main>
      </div>
    </div>
  );
}
