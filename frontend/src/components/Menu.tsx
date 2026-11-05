// The menu links for one role. NavLink marks the current page with aria-current="page".
import { NavLink } from 'react-router';

import { menuFor } from '../menu';
import type { Role } from '../user';

export default function Menu({ role }: { role: Role }) {
  return (
    <ul className="menu-list">
      {menuFor(role).map((entry) => (
        <li key={entry.to}>
          {/* end: "Home" (/) is only current on exactly /, not on every page */}
          <NavLink to={entry.to} end={entry.to === '/'} className="menu-link">
            {entry.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
