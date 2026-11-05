// Tests for F3, log in and auth. Spec: docs/specs/f03-auth.md, section 7.
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiGet } from '../src/api';
import { fakeApi, json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

function fillAndSubmit(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

function loginAnswers(user = OWNER) {
  return {
    'POST /api/auth/login': () => json({ access_token: `token-of-${user.username}`, token_type: 'bearer', user }),
  };
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.[name];
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('logging in', () => {
  it('saves the token in sessionStorage, not localStorage, and opens Home', async () => {
    fakeApi(loginAnswers());
    openAt('/login');
    fillAndSubmit('owner', 'right-password');
    expect(await screen.findByText('Habari, Depot Owner')).toBeTruthy();
    expect(sessionStorage.getItem('depot-token')).toBe('token-of-owner');
    expect(localStorage.getItem('depot-token')).toBeNull();
  });

  it('menu and user card show the real user and role after log in', async () => {
    fakeApi(loginAnswers(SHOPKEEPER));
    openAt('/login');
    fillAndSubmit('shopkeeper', 'right-password');
    const nav = await screen.findByRole('navigation', { name: 'Main menu' });
    expect(within(nav).queryByText('Users')).toBeNull();
    expect(within(nav).queryByText('Items and prices')).toBeNull();
    expect(within(nav).getByText('Shop Keeper')).toBeTruthy();
    expect(within(nav).getByText('Shopkeeper')).toBeTruthy();
  });

  it("wrong password shows the API's message with tries remaining and empties the password", async () => {
    fakeApi({
      'POST /api/auth/login': () =>
        json({ error: 'wrong_credentials', message: 'Wrong username or password. 2 tries remaining', attempts_remaining: 2 }, 401),
    });
    openAt('/login');
    fillAndSubmit('owner', 'wrong');
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong username or password. 2 tries remaining');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('owner');
  });

  it('locked account shows the locked message', async () => {
    fakeApi({
      'POST /api/auth/login': () =>
        json({ error: 'account_locked', message: 'Account locked. Ask the owner to unlock it.' }, 423),
    });
    openAt('/login');
    fillAndSubmit('owner', 'wrong');
    expect((await screen.findByRole('alert')).textContent).toBe('Account locked. Ask the owner to unlock it.');
  });

  it('cannot reach the API shows "Cannot reach the API"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    openAt('/login');
    fillAndSubmit('owner', 'right-password');
    expect((await screen.findByRole('alert')).textContent).toBe('Cannot reach the API. Is it running?');
  });

  it('button says Logging in… and is disabled while waiting', async () => {
    const fetchMock = fakeApi({ 'POST /api/auth/login': () => new Promise<Response>(() => {}) }); // never answers
    openAt('/login');
    fillAndSubmit('owner', 'right-password');
    const button = await screen.findByRole('button', { name: 'Logging in…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button); // a second click must not send a second try
    const loginCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login');
    expect(loginCalls).toHaveLength(1);
  });

  it('a 401 from /auth/login does not end anything; it is a wrong password', async () => {
    fakeApi({
      'POST /api/auth/login': () => json({ error: 'wrong_credentials', message: 'Wrong username or password' }, 401),
    });
    openAt('/login');
    fillAndSubmit('nobody', 'x');
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong username or password');
    expect(screen.queryByText('Your session ended. Please log in again.')).toBeNull();
  });
});

describe('the token on every call', () => {
  it('every call sends Authorization: Bearer <token>', async () => {
    const fetchMock = loggedInAs(OWNER);
    openAt('/');
    await screen.findByText('Habari, Depot Owner');
    const me = fetchMock.mock.calls.find(([url]) => url === '/api/auth/me');
    expect(headerOf(me?.[1], 'Authorization')).toBe('Bearer token-of-owner');
  });

  it('a 401 from any call clears the token and returns to Log in with "Your session ended"', async () => {
    loggedInAs(OWNER, { 'GET /api/stock': () => json({ error: 'not_logged_in', message: 'Please log in' }, 401) });
    openAt('/');
    await screen.findByText('Habari, Depot Owner');
    await act(async () => {
      await apiGet('/stock').catch(() => undefined); // any page's call that comes back 401
    });
    expect(await screen.findByText('Your session ended. Please log in again.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Karibu' })).toBeTruthy();
    expect(sessionStorage.getItem('depot-token')).toBeNull();
  });
});

describe('protected pages', () => {
  it('no token: opening /stock goes to Log in, and after logging in lands on /stock', async () => {
    fakeApi(loginAnswers());
    const router = openAt('/stock');
    expect(await screen.findByRole('heading', { name: 'Karibu' })).toBeTruthy();
    fillAndSubmit('owner', 'right-password');
    expect(await screen.findByText('STORE BALANCE')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/stock');
  });

  it('saved token: the app asks /auth/me and shows Loading… first', async () => {
    let answerMe: (response: Response) => void = () => {};
    sessionStorage.setItem('depot-token', 'token-of-owner');
    fakeApi({ 'GET /api/auth/me': () => new Promise<Response>((resolve) => (answerMe = resolve)) });
    openAt('/');
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => answerMe(json(OWNER)));
    expect(await screen.findByText('Habari, Depot Owner')).toBeTruthy();
  });

  it('saved token for a shopkeeper: shopkeeper menu', async () => {
    loggedInAs(SHOPKEEPER);
    openAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main menu' });
    const labels = within(nav).getAllByRole('listitem').map((item) => item.textContent);
    expect(labels).toEqual(['Home', 'Receive stock', 'Store balance', 'Sales records', 'Restock history']);
  });

  it('shopkeeper opening /users sees Owner only', async () => {
    loggedInAs(SHOPKEEPER);
    openAt('/users');
    expect(await screen.findByText('OWNER ONLY')).toBeTruthy();
    expect(screen.queryByText('Who can log in')).toBeNull();
  });

  it('log out clears the token and returns to Log in', async () => {
    loggedInAs(OWNER);
    openAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Karibu' })).toBeTruthy();
    expect(sessionStorage.getItem('depot-token')).toBeNull();
  });

  it('logged-in user opening /login is sent Home', async () => {
    loggedInAs(OWNER);
    openAt('/login');
    expect(await screen.findByText('Habari, Depot Owner')).toBeTruthy();
  });
});
