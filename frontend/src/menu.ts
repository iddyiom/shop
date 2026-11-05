// The left menu: every entry, and which roles see it. The one place to change the menu.
// Hiding an entry is only for a tidy screen. The server is what refuses owner-only calls (403).
// "New sale" is not here on purpose: it is the big button on Home.
import type { Role } from './user';

export type MenuEntry = {
  label: string;
  to: string;
  roles: Role[];
};

const EVERYONE: Role[] = ['owner', 'shopkeeper'];
const OWNER_ONLY: Role[] = ['owner'];

export const MENU: MenuEntry[] = [
  { label: 'Home', to: '/', roles: EVERYONE },
  { label: 'Receive stock', to: '/receive', roles: EVERYONE },
  { label: 'Store balance', to: '/stock', roles: EVERYONE },
  { label: 'Items and prices', to: '/items', roles: OWNER_ONLY },
  { label: 'Sales records', to: '/sales', roles: EVERYONE },
  { label: 'Restock history', to: '/restock', roles: EVERYONE },
  { label: 'Users', to: '/users', roles: OWNER_ONLY },
];

export function menuFor(role: Role): MenuEntry[] {
  return MENU.filter((entry) => entry.roles.includes(role));
}
