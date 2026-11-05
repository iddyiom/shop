// Tests for F2, the app shell. Spec: docs/specs/f02-shell.md, section 7.
// Since F3 every page needs a logged-in user, so most tests start with loggedInAs(OWNER).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import ApiStatus from '../src/components/ApiStatus';
import Menu from '../src/components/Menu';
import { readTheme } from '../src/theme';
import { fakeApi, loggedInAs, OWNER, openAt } from './helpers';

async function openLoggedIn(path: string) {
  loggedInAs(OWNER);
  openAt(path);
  await screen.findByRole('navigation', { name: 'Main menu' }); // wait for /auth/me
}

function menuLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Main menu' });
  return within(nav)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('menu', () => {
  it('owner menu shows 7 entries in order', async () => {
    await openLoggedIn('/');
    expect(menuLabels()).toEqual([
      'Home', 'Receive stock', 'Store balance', 'Items and prices', 'Sales records', 'Restock history', 'Users',
    ]);
  });

  it('shopkeeper menu has no Items and prices and no Users', () => {
    render(
      <MemoryRouter>
        <Menu role="shopkeeper" />
      </MemoryRouter>,
    );
    const labels = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(labels).toEqual(['Home', 'Receive stock', 'Store balance', 'Sales records', 'Restock history']);
  });

  it('menu never shows New sale; Home shows the big New sale button linking to /sale', async () => {
    await openLoggedIn('/');
    expect(menuLabels()).not.toContain('New sale');
    expect(screen.getByRole('link', { name: /New sale/ }).getAttribute('href')).toBe('/sale');
  });

  it('current page link has aria-current="page"', async () => {
    await openLoggedIn('/stock');
    expect(screen.getByRole('link', { name: 'Store balance' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });
});

describe('pages', () => {
  const pages: [string, string][] = [
    ['/', 'HOME'],
    ['/sale', 'NEW SALE'],
    ['/receive', 'RECEIVE STOCK'],
    ['/stock', 'STORE BALANCE'],
    ['/items', 'ITEMS AND PRICES'],
    ['/sales', 'SALES RECORDS'],
    ['/restock', 'RESTOCK HISTORY'],
    ['/users', 'USERS'],
  ];

  it.each(pages)('%s shows its page title (%s)', async (path, eyebrow) => {
    await openLoggedIn(path);
    expect(screen.getByText(eyebrow)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('unknown address shows Page not found with a link Home', async () => {
    await openLoggedIn('/nothing-here');
    expect(screen.getByText('PAGE NOT FOUND')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'go back Home' }).getAttribute('href')).toBe('/');
  });

  it('log in page has no menu', async () => {
    fakeApi();
    openAt('/login');
    expect(await screen.findByRole('heading', { name: 'Karibu' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('skip link comes before the menu', async () => {
    await openLoggedIn('/');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(skip.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('theme', () => {
  it('theme switch flips data-theme and saves the choice', async () => {
    await openLoggedIn('/');
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('depot-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('saved theme is used when the app starts', async () => {
    localStorage.setItem('depot-theme', 'dark');
    expect(readTheme()).toBe('dark');
    await openLoggedIn('/');
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeTruthy();
  });

  it('broken storage does not break the theme switch', async () => {
    fakeApi();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(readTheme()).toBe('light');
    openAt('/login'); // storage blocked also means no token: the Log in page has the switch too
    fireEvent.click(await screen.findByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('API status pill', () => {
  it('says "API connected" when /health is ok', async () => {
    fakeApi();
    render(<ApiStatus />);
    expect(await screen.findByText('API connected')).toBeTruthy();
  });

  it('says "API not reachable" when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<ApiStatus />);
    expect(await screen.findByText('API not reachable')).toBeTruthy();
  });
});
