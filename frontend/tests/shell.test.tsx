// Tests for F2, the app shell. Spec: docs/specs/f02-shell.md, section 7.
// Since F3 every page needs a logged-in user, so most tests start with loggedInAs(OWNER).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import ApiStatus from '../src/components/ApiStatus';
import Menu from '../src/components/Menu';
import ThemeSwitch from '../src/components/ThemeSwitch';
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
  it('owner menu shows 7 entries in order, in the groups Work and Owner', async () => {
    await openLoggedIn('/');
    expect(menuLabels()).toEqual([
      'Home', 'Receive stock', 'Store balance', 'Sales records', 'Restock history', 'Items and prices', 'Users',
    ]);
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(nav).getByText('Work')).toBeTruthy();
    expect(within(nav).getByText('Owner')).toBeTruthy();
  });

  it('shopkeeper menu has no Items and prices and no Users', () => {
    render(
      <MemoryRouter>
        <Menu role="shopkeeper" />
      </MemoryRouter>,
    );
    const labels = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(labels).toEqual(['Home', 'Receive stock', 'Store balance', 'Sales records', 'Restock history']);
    expect(screen.queryByText('Owner')).toBeNull(); // the Owner group is not drawn at all
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
  // No eyebrow line any more (R1 spec, section 11): each page has its h1, and the tab names it.
  const pages: [string, string][] = [
    ['/', 'Home'],
    ['/sale', 'New sale'],
    ['/receive', 'Receive stock'],
    ['/stock', 'Store balance'],
    ['/items', 'Items and prices'],
    ['/sales', 'Sales records'],
    ['/restock', 'Restock history'],
    ['/users', 'Users'],
  ];

  it.each(pages)('%s shows a page title and names the tab "%s"', async (path, tab) => {
    await openLoggedIn(path);
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    await waitFor(() => expect(document.title).toBe(`${tab} · Depot`));
  });

  it('unknown address shows Page not found with a link Home', async () => {
    await openLoggedIn('/nothing-here');
    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'go back Home' }).getAttribute('href')).toBe('/');
  });

  it('log in page has no menu', async () => {
    fakeApi();
    openAt('/login');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
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
    render(<ThemeSwitch />); // the Log in page has no switch any more, so test the button itself
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

// R1 redesign: docs/specs/r01-redesign.md, section 7.
describe('menu collapse and pop-up (R1)', () => {
  const shell = () => document.querySelector('.shell');

  it('collapse hides the labels visually but every link keeps its name', async () => {
    await openLoggedIn('/stock');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(shell()?.classList.contains('collapsed')).toBe(true); // CSS turns this into the icon rail
    // The labels are still in the page, so the names (and the menu's text) are unchanged.
    expect(screen.getByRole('link', { name: 'Store balance' }).getAttribute('aria-current')).toBe('page');
    expect(menuLabels()).toContain('Restock history');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('title')).toBe('Home'); // tooltip
  });

  it('the collapse button reports aria-expanded and the choice is remembered', async () => {
    await openLoggedIn('/');
    const button = screen.getByRole('button', { name: 'Collapse menu' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Expand menu' }).getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('depot-menu')).toBe('collapsed');

    cleanup(); // open the app again: it starts collapsed
    await openLoggedIn('/');
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeTruthy();
    expect(shell()?.classList.contains('collapsed')).toBe(true);
  });

  it('the phone menu opens, closes with the button, and closes after choosing a page', async () => {
    await openLoggedIn('/');
    const open = screen.getByRole('button', { name: 'Open menu' });
    expect(open.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(open);
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(shell()?.classList.contains('drawer-open')).toBe(true);
    // Two ways to close: the dark layer and the ✕ in the menu. Use the ✕.
    const closers = screen.getAllByRole('button', { name: 'Close menu' });
    expect(closers).toHaveLength(2);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main menu' })).getByRole('button', { name: 'Close menu' }));
    expect(shell()?.classList.contains('drawer-open')).toBe(false);

    fireEvent.click(open); // Escape closes it too
    fireEvent.keyDown(screen.getByRole('link', { name: 'Home' }), { key: 'Escape' });
    expect(shell()?.classList.contains('drawer-open')).toBe(false);

    fireEvent.click(open); // choosing a page closes it and opens that page
    const nav = screen.getByRole('navigation', { name: 'Main menu' }); // Home has its own Store balance link
    fireEvent.click(within(nav).getByRole('link', { name: 'Store balance' }));
    expect(shell()?.classList.contains('drawer-open')).toBe(false);
    expect(open.getAttribute('aria-expanded')).toBe('false');
    expect(await screen.findByRole('heading', { name: 'What is in the store' })).toBeTruthy();
  });

  it('every page starts with the header row: menu button, title, theme button, the user', async () => {
    await openLoggedIn('/stock');
    const header = screen.getByRole('main').querySelector('.page-header') as HTMLElement;
    expect(within(header).getByRole('button', { name: 'Collapse menu' })).toBeTruthy();
    expect(within(header).getByRole('heading', { level: 1, name: 'What is in the store' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Dark mode' })).toBeTruthy();
    expect(within(header).getByText('Depot Owner')).toBeTruthy();
    expect(document.querySelector('.topbar')).toBeNull(); // no top bar (Iddy's choice)
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
