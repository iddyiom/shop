// Tests for F10, the Users page. Spec: docs/specs/f10-users.md, section 7.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../src/types';
import { json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

const ASHA: User = { id: 3, full_name: 'Asha Juma', username: 'asha', role: 'shopkeeper', is_locked: true, is_active: true };
const OLD: User = { id: 4, full_name: 'Baraka Mushi', username: 'baraka', role: 'shopkeeper', is_locked: false, is_active: false };
const OWNER2: User = { id: 5, full_name: 'Second Owner', username: 'owner2', role: 'owner', is_locked: false, is_active: true };
const ALL = [OWNER, ASHA, OLD, OWNER2]; // OWNER (id 1) is the one logged in

type Answer = (init?: RequestInit) => Response | Promise<Response>;

async function openUsers(extra: Record<string, Answer> = {}, list: User[] = ALL) {
  let listCalls = 0;
  const fetchMock = loggedInAs(OWNER, {
    'GET /api/users': () => {
      listCalls += 1;
      return json(list);
    },
    ...extra,
  });
  openAt('/users');
  await screen.findByRole('heading', { name: 'All accounts' });
  return { fetchMock, listCalls: () => listCalls };
}

const row = (name: string) => screen.getByRole('listitem', { name });
const changes = (fetchMock: ReturnType<typeof loggedInAs>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([url, init]) => [url, init?.method, init?.body ? JSON.parse(String(init.body)) : undefined]);

function fillForm(name: string, username: string, password: string, role?: 'Shopkeeper' | 'Owner') {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('First password'), { target: { value: password } });
  if (role) fireEvent.click(screen.getByLabelText(role));
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('accounts', () => {
  it('lists every account with name, @username, role and badge', async () => {
    await openUsers();
    expect(within(row('Asha Juma')).getByText('@asha · Shopkeeper')).toBeTruthy();
    expect(within(row('Asha Juma')).getByText('Locked')).toBeTruthy();
    expect(within(row('Asha Juma')).queryByText('Active')).toBeNull(); // Locked wins
    expect(within(row('Baraka Mushi')).getByText('Deactivated')).toBeTruthy();
    expect(within(row('Second Owner')).getByText('@owner2 · Owner')).toBeTruthy();
    expect(within(row('Second Owner')).getByText('Active')).toBeTruthy();
  });

  it('locked account shows a banner; Unlock calls /users/{id}/unlock, reloads and shows a note', async () => {
    const { fetchMock, listCalls } = await openUsers({
      'POST /api/users/3/unlock': () => json({ ...ASHA, is_locked: false }),
    });
    const banner = screen.getByRole('region', { name: 'Asha Juma is locked out' });
    expect(banner.textContent).toContain('Check it was really Asha, then unlock.');
    fireEvent.click(within(banner).getByRole('button', { name: 'Unlock Asha' }));
    expect(await screen.findByText('Asha Juma unlocked')).toBeTruthy();
    await waitFor(() => expect(listCalls()).toBe(2));
    expect(changes(fetchMock)).toEqual([['/api/users/3/unlock', 'POST', {}]]);
  });

  it('no banner when nobody is locked', async () => {
    await openUsers({}, [OWNER, OWNER2]);
    expect(screen.queryByRole('region', { name: /locked out/ })).toBeNull();
  });

  it('your own row says (you) and has no Deactivate button', async () => {
    await openUsers();
    const mine = row('Depot Owner');
    expect(within(mine).getByText('Depot Owner (you)')).toBeTruthy();
    expect(within(mine).queryByRole('button')).toBeNull();
    // Question 4: another owner CAN be deactivated.
    expect(within(row('Second Owner')).getByRole('button', { name: 'Deactivate Second' })).toBeTruthy();
  });

  it('deactivate asks first; Cancel sends nothing; Yes sends PATCH {is_active:false} and reloads', async () => {
    const { fetchMock, listCalls } = await openUsers({
      'PATCH /api/users/5': () => json({ ...OWNER2, is_active: false }),
    });
    fireEvent.click(within(row('Second Owner')).getByRole('button', { name: 'Deactivate Second' }));
    expect(screen.getByRole('heading', { name: 'Deactivate Second Owner?' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })); // the safe choice has focus
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Deactivate Second Owner?' })).toBeNull();
    expect(changes(fetchMock)).toEqual([]);

    fireEvent.click(within(row('Second Owner')).getByRole('button', { name: 'Deactivate Second' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, deactivate' }));
    expect(await screen.findByText('Second Owner deactivated')).toBeTruthy();
    await waitFor(() => expect(listCalls()).toBe(2));
    expect(changes(fetchMock)).toEqual([['/api/users/5', 'PATCH', { is_active: false }]]);
  });

  it('deactivated account shows Bring back; it sends PATCH {is_active:true}', async () => {
    const { fetchMock } = await openUsers({ 'PATCH /api/users/4': () => json({ ...OLD, is_active: true }) });
    fireEvent.click(within(row('Baraka Mushi')).getByRole('button', { name: 'Bring back Baraka' }));
    expect(await screen.findByText('Baraka Mushi can log in again')).toBeTruthy();
    expect(changes(fetchMock)).toEqual([['/api/users/4', 'PATCH', { is_active: true }]]);
  });

  it('a 404 (someone changed the list) shows the message and reloads', async () => {
    const { listCalls } = await openUsers({
      'PATCH /api/users/4': () => json({ error: 'not_found', message: 'User not found' }, 404),
    });
    fireEvent.click(within(row('Baraka Mushi')).getByRole('button', { name: 'Bring back Baraka' }));
    expect(await screen.findByText('User not found')).toBeTruthy();
    await waitFor(() => expect(listCalls()).toBe(2));
  });
});

describe('add a user', () => {
  it('problems are shown under their fields and nothing is sent', async () => {
    const { fetchMock } = await openUsers();
    fillForm('  ', 'ab', 'short', 'Shopkeeper');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter the full name.')).toBeTruthy();
    expect(screen.getByText('The username needs at least 3 characters.')).toBeTruthy();
    expect(screen.getByText('The password needs at least 8 characters.')).toBeTruthy();
    expect(screen.getByLabelText('Username').getAttribute('aria-invalid')).toBe('true');
    expect(changes(fetchMock)).toEqual([]);
  });

  it('no role chosen blocks Create', async () => {
    const { fetchMock } = await openUsers();
    fillForm('Neema Said', 'neema', 'strong-pass');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Choose Shopkeeper or Owner.')).toBeTruthy();
    expect((screen.getByLabelText('Shopkeeper') as HTMLInputElement).checked).toBe(false); // nothing preselected
    expect((screen.getByLabelText('Owner') as HTMLInputElement).checked).toBe(false);
    expect(changes(fetchMock)).toEqual([]);
  });

  it('sends {full_name, username, password, role}, clears the form, reloads, shows a note', async () => {
    const created: User = { id: 6, full_name: 'Neema Said', username: 'neema', role: 'shopkeeper', is_locked: false, is_active: true };
    const { fetchMock, listCalls } = await openUsers({ 'POST /api/users': () => json(created, 201) });
    fillForm(' Neema Said ', 'neema', 'strong-pass', 'Shopkeeper');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Account created for Neema Said')).toBeTruthy();
    await waitFor(() => expect(listCalls()).toBe(2));
    expect(changes(fetchMock)).toEqual([
      ['/api/users', 'POST', { full_name: 'Neema Said', username: 'neema', password: 'strong-pass', role: 'shopkeeper' }],
    ]);
    expect((screen.getByLabelText('First password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('');
    expect(JSON.stringify(sessionStorage)).not.toContain('strong-pass'); // rule 8
  });

  it('username_taken shows "That username is already used" and keeps the form', async () => {
    await openUsers({
      'POST /api/users': () => json({ error: 'username_taken', message: 'That username is already used' }, 409),
    });
    fillForm('Asha Two', 'asha', 'strong-pass', 'Shopkeeper');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('That username is already used')).toBeTruthy();
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('asha');
  });

  it('a button says Saving… and is disabled while waiting', async () => {
    await openUsers({ 'POST /api/users': () => new Promise<Response>(() => {}) });
    fillForm('Neema Said', 'neema', 'strong-pass', 'Owner');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('owner only', () => {
  it('shopkeeper opening /users sees Owner only and GET /users is never asked', async () => {
    const fetchMock = loggedInAs(SHOPKEEPER, { 'GET /api/users': () => json(ALL) });
    openAt('/users');
    expect(await screen.findByRole('heading', { name: 'This page is for the owner' })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/users')).toBe(false);
  });
});
