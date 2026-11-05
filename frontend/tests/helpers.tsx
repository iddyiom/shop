// Shared test helpers: a fake API and a way to open the app at an address.
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '../src/routes';
import type { User } from '../src/types';

export const OWNER: User = {
  id: 1, full_name: 'Depot Owner', username: 'owner', role: 'owner', is_locked: false, is_active: true,
};
export const SHOPKEEPER: User = {
  id: 2, full_name: 'Shop Keeper', username: 'shopkeeper', role: 'shopkeeper', is_locked: false, is_active: true,
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Answer = (init?: RequestInit) => Response | Promise<Response>;

/**
 * Replace fetch with a fake API. Keys look like "GET /api/auth/me".
 * /api/health always answers ok. Anything not listed answers 404.
 */
export function fakeApi(answers: Record<string, Answer> = {}) {
  const all: Record<string, Answer> = { 'GET /api/health': () => json({ status: 'ok' }), ...answers };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const answer = all[`${init?.method ?? 'GET'} ${url}`];
    return answer ? answer(init) : json({ error: 'not_found', message: 'Not found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Pretend `user` logged in earlier in this tab: a saved token, and /auth/me knows them. */
export function loggedInAs(user: User, extra: Record<string, Answer> = {}) {
  sessionStorage.setItem('depot-token', `token-of-${user.username}`);
  return fakeApi({ 'GET /api/auth/me': () => json(user), ...extra });
}

/** Open the app at an address, like typing it into the browser. */
export function openAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
