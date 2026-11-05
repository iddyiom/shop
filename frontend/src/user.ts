// Who is using the app, in the shape the screens need. The real user comes from auth.tsx.
import { useAuth } from './auth';

export type Role = 'owner' | 'shopkeeper';

export type CurrentUser = {
  fullName: string;
  role: Role;
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  shopkeeper: 'Shopkeeper',
};

/** Only for pages inside RequireAuth, where a user always exists. */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser() needs a logged-in user (use it inside RequireAuth)');
  return { fullName: user.full_name, role: user.role };
}
