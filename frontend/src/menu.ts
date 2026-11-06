// The left menu: every entry, which group it is in, and which roles see it.
// The one place to change the menu. Hiding an entry is only for a tidy screen:
// the server is what refuses owner-only calls (403).
// "New sale" is not here on purpose: it is the first button on Home.
import {
  History,
  House,
  Package,
  ReceiptText,
  Tag,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { Role } from './user';

export type MenuGroup = 'work' | 'owner';

export type MenuEntry = {
  label: string;
  to: string;
  roles: Role[];
  group: MenuGroup;
  icon: LucideIcon; // decoration only: the label is what screen readers read
};

const EVERYONE: Role[] = ['owner', 'shopkeeper'];
const OWNER_ONLY: Role[] = ['owner'];

export const MENU_GROUPS: { id: MenuGroup; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'owner', label: 'Owner' },
];

export const MENU: MenuEntry[] = [
  { label: 'Home', to: '/', roles: EVERYONE, group: 'work', icon: House },
  { label: 'Receive stock', to: '/receive', roles: EVERYONE, group: 'work', icon: Truck },
  { label: 'Store balance', to: '/stock', roles: EVERYONE, group: 'work', icon: Package },
  { label: 'Sales records', to: '/sales', roles: EVERYONE, group: 'work', icon: ReceiptText },
  { label: 'Restock history', to: '/restock', roles: EVERYONE, group: 'work', icon: History },
  { label: 'Items and prices', to: '/items', roles: OWNER_ONLY, group: 'owner', icon: Tag },
  { label: 'Users', to: '/users', roles: OWNER_ONLY, group: 'owner', icon: Users },
];

export function menuFor(role: Role): MenuEntry[] {
  return MENU.filter((entry) => entry.roles.includes(role));
}
