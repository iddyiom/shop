// Tests for F2, the app shell. Spec: docs/specs/f02-shell.md, section 7.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';

import ApiStatus from '../src/components/ApiStatus';
import Menu from '../src/components/Menu';
import { routes } from '../src/routes';
import { readTheme } from '../src/theme';

/** Show the app at one address, like typing it into the browser. */
function openAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

function menuLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Main menu' });
  return within(nav)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

beforeEach(() => {
  // The API pill asks /health on every page: answer "ok" unless a test says otherwise.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' })))));
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('menu', () => {
  it('owner menu shows 7 entries in order', () => {
    openAt('/');
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

  it('menu never shows New sale; Home shows the big New sale button linking to /sale', () => {
    openAt('/');
    expect(menuLabels()).not.toContain('New sale');
    const button = screen.getByRole('link', { name: /New sale/ });
    expect(button.getAttribute('href')).toBe('/sale');
  });

  it('current page link has aria-current="page"', () => {
    openAt('/stock');
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

  it.each(pages)('%s shows its page title (%s)', (path, eyebrow) => {
    openAt(path);
    expect(screen.getByText(eyebrow)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('unknown address shows Page not found with a link Home', () => {
    openAt('/nothing-here');
    expect(screen.getByText('PAGE NOT FOUND')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'go back Home' }).getAttribute('href')).toBe('/');
  });

  it('log in page has no menu', () => {
    openAt('/login');
    expect(screen.getByRole('heading', { name: 'Karibu' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('skip link comes before the menu', () => {
    openAt('/');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    // DOCUMENT_POSITION_FOLLOWING: the menu comes after the skip link
    expect(skip.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('theme', () => {
  it('theme switch flips data-theme and saves the choice', () => {
    openAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('depot-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('saved theme is used when the app starts', () => {
    localStorage.setItem('depot-theme', 'dark');
    expect(readTheme()).toBe('dark');
    openAt('/');
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeTruthy(); // offers to go back to light
  });

  it('broken storage does not break the theme switch', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(readTheme()).toBe('light');
    openAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('API status pill', () => {
  it('says "API connected" when /health is ok', async () => {
    render(<ApiStatus />);
    expect(await screen.findByText('API connected')).toBeTruthy();
  });

  it('says "API not reachable" when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<ApiStatus />);
    expect(await screen.findByText('API not reachable')).toBeTruthy();
  });
});
