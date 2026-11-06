// Tests for src/users.ts. Spec: docs/specs/f10-users.md, section 7.
import { describe, expect, it } from 'vitest';

import type { User } from '../src/types';
import { checkNewUser, firstName, initials, userBadges } from '../src/users';

const user = (is_active: boolean, is_locked: boolean): User => ({
  id: 3, full_name: 'Asha Juma', username: 'asha', role: 'shopkeeper', is_active, is_locked,
});

const good = { fullName: 'Neema Said', username: 'neema.s', password: 'strong-pass', role: 'shopkeeper' as const };

describe('users rules', () => {
  it('badges: active, locked, deactivated, deactivated and locked', () => {
    expect(userBadges(user(true, false))).toEqual(['Active']);
    expect(userBadges(user(true, true))).toEqual(['Locked']);
    expect(userBadges(user(false, false))).toEqual(['Deactivated']);
    expect(userBadges(user(false, true))).toEqual(['Deactivated', 'Locked']);
  });

  it('initials and first name from a full name', () => {
    expect(initials('Asha Juma')).toBe('AJ');
    expect(initials('  neema  ')).toBe('N');
    expect(initials('Mary Anne Mushi')).toBe('MM');
    expect(firstName('Asha Juma')).toBe('Asha');
    expect(firstName(' Neema ')).toBe('Neema');
  });

  it('checkNewUser: empty name, short username, bad characters, short password, all good', () => {
    expect(checkNewUser(good)).toEqual({});
    expect(checkNewUser({ ...good, fullName: '   ' }).fullName).toBe('Enter the full name.');
    expect(checkNewUser({ ...good, username: 'ab' }).username).toBe('The username needs at least 3 characters.');
    expect(checkNewUser({ ...good, username: 'asha juma' }).username).toBe('Use only letters, numbers, dot or underscore.');
    expect(checkNewUser({ ...good, password: 'short' }).password).toBe('The password needs at least 8 characters.');
    expect(checkNewUser({ ...good, password: 'é'.repeat(40) }).password).toBe('The password is too long.'); // 80 bytes
    expect(checkNewUser({ ...good, role: null }).role).toBe('Choose Shopkeeper or Owner.');
  });
});
