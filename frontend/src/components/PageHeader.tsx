// The header row at the top of every page (there is no top bar, R1 spec section 11):
// the menu button, the page title and its short line, the page's own round buttons,
// the theme button, and who is logged in. It also names the browser tab.
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { useFrame } from '../frame';
import { ROLE_LABEL, useCurrentUser } from '../user';
import { initials } from '../users';
import ApiStatus from './ApiStatus';
import ThemeSwitch from './ThemeSwitch';

type Props = {
  title: ReactNode; // e.g. "What is in the store"
  subtitle?: ReactNode; // the muted line under it
  tabTitle: string; // e.g. "Store balance" (the browser tab)
  actions?: ReactNode; // round buttons before the theme button, e.g. Refresh on Home
};

export default function PageHeader({ title, subtitle, tabTitle, actions }: Props) {
  const { collapsed, drawerOpen, toggleCollapsed, openDrawer } = useFrame();
  const user = useCurrentUser();

  useEffect(() => {
    document.title = `${tabTitle} · Depot`;
  }, [tabTitle]);

  const collapseLabel = collapsed ? 'Expand menu' : 'Collapse menu';
  return (
    <header className="page-header">
      {/* Laptop (CSS): shrink the menu to icons and back. */}
      <button
        type="button"
        className="icon-button collapse-button"
        aria-label={collapseLabel}
        title={collapseLabel}
        aria-expanded={!collapsed}
        aria-controls="main-menu"
        onClick={toggleCollapsed}
      >
        {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      </button>
      {/* Phone (CSS): pop the menu up as a drawer. */}
      <button
        type="button"
        className="icon-button menu-button"
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        aria-controls="main-menu"
        onClick={openDrawer}
      >
        <MenuIcon size={18} aria-hidden="true" />
      </button>

      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      <div className="page-actions">
        {actions}
        <ThemeSwitch />
        <span className="user-chip">
          <span className="avatar" aria-hidden="true">
            {initials(user.fullName)}
          </span>
          <span className="user-chip-text">
            <strong>{user.fullName}</strong>
            <span>
              <span>{ROLE_LABEL[user.role]}</span> · <ApiStatus />
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}

/** The F2 stand-in for a page's content. */
export function ComingSoon({ unit }: { unit: string }) {
  return <p className="coming-soon">Coming in unit {unit}.</p>;
}
