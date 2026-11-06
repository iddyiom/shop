// The frame around every page except Log in: the menu on the left, the page beside it.
// There is no top bar (R1 spec, section 11): each page's header row (PageHeader.tsx) has
// the menu button, so the frame shares its menu state through FrameContext.
// The menu collapses to an icon rail on a laptop, and pops up as a drawer on a phone.
import { LogOut, X } from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Outlet, useLocation } from 'react-router';

import { useAuth } from '../auth';
import { FrameContext, type Frame } from '../frame';
import { useCurrentUser } from '../user';
import Menu from './Menu';

const MENU_KEY = 'depot-menu'; // remembered like the theme: a screen preference, never data

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(MENU_KEY) === 'collapsed';
  } catch {
    return false; // storage blocked: start open
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(MENU_KEY, collapsed ? 'collapsed' : 'open');
  } catch {
    // Not remembered is fine.
  }
}

export default function Layout() {
  const user = useCurrentUser();
  const { logOut } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed); // laptop: icon rail
  const [drawerOpen, setDrawerOpen] = useState(false); // phone: the pop-up menu

  // A new page (link, Back button) always closes the phone drawer.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const frame: Frame = useMemo(
    () => ({
      collapsed,
      drawerOpen,
      toggleCollapsed: () => {
        setCollapsed((current) => {
          saveCollapsed(!current);
          return !current;
        });
      },
      openDrawer: () => setDrawerOpen(true),
    }),
    [collapsed, drawerOpen],
  );

  // Escape closes the drawer. On the menu itself, not the whole window.
  function onMenuKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') setDrawerOpen(false);
  }

  const classes = ['shell', collapsed ? 'collapsed' : '', drawerOpen ? 'drawer-open' : ''].join(' ').trim();

  return (
    <FrameContext.Provider value={frame}>
      <div className={classes}>
        {/* First thing Tab reaches: jump past the menu straight to the page. */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        {/* Phone only (CSS): the dark layer behind the open drawer. Tapping it closes the menu. */}
        {drawerOpen && (
          <button type="button" className="drawer-scrim" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
        )}

        <nav className="menu" aria-label="Main menu" id="main-menu" onKeyDown={onMenuKey}>
          <div className="menu-top">
            <div className="logo">
              <span className="logo-mark" aria-hidden="true">
                D
              </span>
              <span className="logo-text">
                <span className="logo-name">Depot</span>
                <span className="logo-note">Distribution depot</span>
              </span>
            </div>
            <button
              type="button"
              className="icon-button drawer-close"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <Menu role={user.role} onNavigate={() => setDrawerOpen(false)} />

          {/* After logOut() there is no user, so RequireAuth sends us to /login. */}
          <button type="button" className="menu-link menu-logout" title="Log out" onClick={logOut}>
            <LogOut className="menu-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
            <span className="menu-label">Log out</span>
          </button>
        </nav>

        {/* tabIndex -1: the skip link can move keyboard focus here */}
        <main id="main" className="page" tabIndex={-1}>
          <Outlet /> {/* the page for the current address; it draws its own header row */}
        </main>
      </div>
    </FrameContext.Provider>
  );
}
