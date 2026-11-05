// Who is using the app. Until F3 (log in) this is a fixed example owner.
// F3 changes only the inside of useCurrentUser(); everything else stays the same.

export type Role = 'owner' | 'shopkeeper';

export type CurrentUser = {
  fullName: string;
  role: Role;
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  shopkeeper: 'Shopkeeper',
};

export function useCurrentUser(): CurrentUser {
  return { fullName: 'Depot Owner', role: 'owner' };
}
