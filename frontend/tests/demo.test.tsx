// Tests for D1, demo quick log in (development only). Spec: docs/specs/d01-demo-login.md.
// Vitest runs in development mode (import.meta.env.DEV is true), like `npm run dev`.
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import devAccounts from '../dev-accounts.json';
import { fakeApi, json, OWNER, openAt } from './helpers';

const [demoOwner] = devAccounts.accounts;

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('demo accounts on the Log in page', () => {
  it('log in page shows the demo box in development', async () => {
    fakeApi();
    openAt('/login');
    expect(await screen.findByRole('heading', { name: 'Demo accounts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Owner/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Shopkeeper/ })).toBeTruthy();
  });

  it('clicking Owner logs in as the demo owner', async () => {
    const fetchMock = fakeApi({
      'POST /api/auth/login': () => json({ access_token: 'demo-token', token_type: 'bearer', user: OWNER }),
    });
    openAt('/login');
    fireEvent.click(await screen.findByRole('button', { name: /^Owner/ }));
    expect(await screen.findByText('Habari, Depot Owner')).toBeTruthy();

    const login = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login');
    expect(JSON.parse(String(login?.[1]?.body))).toEqual({
      username: demoOwner.username,
      password: demoOwner.password,
    });
  });

  it('a failed demo log in shows the API message and the add-demo-users hint', async () => {
    fakeApi({
      'POST /api/auth/login': () => json({ error: 'wrong_credentials', message: 'Wrong username or password' }, 401),
    });
    openAt('/login');
    fireEvent.click(await screen.findByRole('button', { name: /^Owner/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong username or password');
    expect(screen.getByText('Create or reset them: python -m app.manage add-demo-users')).toBeTruthy();
  });
});
