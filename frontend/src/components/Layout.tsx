// The frame around every page except Log in: menu on the left, top bar, page in the middle.
import { Outlet } from 'react-router';

import { useAuth } from '../auth';
import { ROLE_LABEL, useCurrentUser } from '../user';
import ApiStatus from './ApiStatus';
import Menu from './Menu';
import ThemeSwitch from './ThemeSwitch';

export default function Layout() {
  const user = useCurrentUser();
  const { logOut } = useAuth();

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
          {/* After logOut() there is no user, so RequireAuth sends us to /login. */}
          <button type="button" className="user-logout" onClick={logOut}>
            Log out
          </button>
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
