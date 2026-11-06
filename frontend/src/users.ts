// Plain rules for the Users page (F10), kept apart so they are easy to test.
// The server checks everything again; these give friendly messages first.
import type { Role } from './user';
import type { User } from './types';

export type Badge = 'Active' | 'Locked' | 'Deactivated'; // sentence case (R2b)

/**
 * Rule 2: Locked wins over Active. A deactivated account also shows Locked if it is locked,
 * so the owner knows Unlock is still needed after bringing it back (B1: reactivating keeps a lock).
 */
export function userBadges(user: User): Badge[] {
  if (!user.is_active) return user.is_locked ? ['Deactivated', 'Locked'] : ['Deactivated'];
  return user.is_locked ? ['Locked'] : ['Active'];
}

/** "Asha Juma" → "AJ", "Neema" → "N". */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** "Asha Juma" → "Asha" (for buttons like "Unlock Asha"). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export type NewUserForm = {
  fullName: string;
  username: string;
  password: string;
  role: Role | null; // question 3: must be chosen
};

export type NewUserProblems = Partial<Record<keyof NewUserForm, string>>;

const USERNAME = /^[a-zA-Z0-9_.]+$/; // the same pattern as UserCreate in app/schemas.py
const MAX_PASSWORD_BYTES = 72; // the same limit as app/security.py (bcrypt)

/** Rule 6: the same limits as the server's UserCreate. An empty object means all good. */
export function checkNewUser(form: NewUserForm): NewUserProblems {
  const problems: NewUserProblems = {};
  const name = form.fullName.trim();
  if (name === '') problems.fullName = 'Enter the full name.';
  else if (name.length > 100) problems.fullName = 'The name is too long (100 characters at most).';

  const username = form.username.trim();
  if (username.length < 3) problems.username = 'The username needs at least 3 characters.';
  else if (username.length > 50) problems.username = 'The username is too long (50 characters at most).';
  else if (!USERNAME.test(username)) problems.username = 'Use only letters, numbers, dot or underscore.';

  if (form.password.length < 8) problems.password = 'The password needs at least 8 characters.';
  else if (new TextEncoder().encode(form.password).length > MAX_PASSWORD_BYTES) {
    problems.password = 'The password is too long.';
  }

  if (form.role === null) problems.role = 'Choose Shopkeeper or Owner.';
  return problems;
}
