// The left menu: every entry, which group it is in, and which roles see it.
// The one place to change the menu. Hiding an entry is only for a tidy screen:
// the server is what refuses owner-only calls (403).
// "New sale" is not here on purpose: it is the first button on Home.
import type { IconName } from './components/Icon';

import type { Role } from './user';

export type MenuGroup = 'work' | 'owner';

export type MenuEntry = {
  label: string;
  to: string;
  roles: Role[];
  group: MenuGroup;
  icon: IconName; // Solar icon (components/Icon.tsx); decoration only: the label is what screen readers read
};

const EVERYONE: Role[] = ['owner', 'shopkeeper'];
const OWNER_ONLY: Role[] = ['owner'];

export const MENU_GROUPS: { id: MenuGroup; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'owner', label: 'Owner' },
];

export const MENU: MenuEntry[] = [
  { label: 'Home', to: '/', roles: EVERYONE, group: 'work', icon: 'home' },
  { label: 'Receive stock', to: '/receive', roles: EVERYONE, group: 'work', icon: 'delivery' },
  { label: 'Store balance', to: '/stock', roles: EVERYONE, group: 'work', icon: 'box' },
  { label: 'Sales records', to: '/sales', roles: EVERYONE, group: 'work', icon: 'billList' },
  { label: 'Restock history', to: '/restock', roles: EVERYONE, group: 'work', icon: 'history' },
  { label: 'Items and prices', to: '/items', roles: OWNER_ONLY, group: 'owner', icon: 'tagPrice' },
  { label: 'Users', to: '/users', roles: OWNER_ONLY, group: 'owner', icon: 'users' },
];

export function menuFor(role: Role): MenuEntry[] {
  return MENU.filter((entry) => entry.roles.includes(role));
}
