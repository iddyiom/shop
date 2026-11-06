// The menu links for one role, in groups (Work, Owner). A group with no links for this
// role is not drawn at all, so a shopkeeper never sees "Owner".
// NavLink marks the current page with aria-current="page". When the menu is collapsed,
// CSS hides the labels only visually, so screen readers (and tests) still read them.
import { NavLink } from 'react-router';

import { MENU_GROUPS, menuFor } from '../menu';
import type { Role } from '../user';
import Icon from './Icon';

type Props = {
  role: Role;
  onNavigate?: () => void; // the phone drawer closes after a page is chosen
};

export default function Menu({ role, onNavigate }: Props) {
  const entries = menuFor(role);
  return (
    <>
      {MENU_GROUPS.map((group) => {
        const inGroup = entries.filter((entry) => entry.group === group.id);
        if (inGroup.length === 0) return null;
        return (
          <div key={group.id} className="menu-group">
            <p className="menu-group-label">
              {group.label}
            </p>
            <ul className="menu-list">
              {inGroup.map((entry) => {
                return (
                  <li key={entry.to}>
                    {/* end: "Home" (/) is only current on exactly /, not on every page */}
                    <NavLink
                      to={entry.to}
                      end={entry.to === '/'}
                      className="menu-link"
                      title={entry.label}
                      onClick={onNavigate}
                    >
                      <Icon name={entry.icon} className="menu-icon" size={20} />
                      <span className="menu-label">{entry.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}
