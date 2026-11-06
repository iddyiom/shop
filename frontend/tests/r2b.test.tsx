// Tests for R2b, shared components. Spec: docs/specs/r02-shared-pieces.md, section 11.4.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MENU } from '../src/menu';
import type { Product, StockLine, Summary, User } from '../src/types';
import { json, loggedInAs, OWNER, openAt } from './helpers';

const DAY = '2026-11-05';
const never = () => new Promise<Response>(() => {}); // an answer that never comes: stays loading

const stockLine = (id: number, product: string, stock: number, status: StockLine['stock_status']): StockLine => ({
  product_id: id, product, group_id: 1, group: 'Soda', quantity_in_store: stock, min_level: 3,
  stock_status: status, is_active: true,
});

const FANTA: Product = {
  id: 1, name: 'Fanta', group_id: 1, group: 'Soda', own_price: null, effective_price: 1000,
  quantity_in_store: 5, min_level: 3, stock_status: 'OK', is_active: true,
};

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

describe('header (R2b rule 1)', () => {
  // Home is the exception: its h1 is the greeting (open question 1).
  const menuPages = MENU.filter((entry) => entry.to !== '/').map((entry): [string, string] => [entry.to, entry.label]);

  it.each(menuPages)("%s: the h1 and the browser tab are the menu name \"%s\"", async (path, name) => {
    loggedInAs(OWNER);
    openAt(path);
    expect(await screen.findByRole('heading', { level: 1, name })).toBeTruthy();
    await waitFor(() => expect(document.title).toBe(`${name} · Depot`));
  });

  it('the old friendly title is now the line under the h1 (Store balance)', async () => {
    loggedInAs(OWNER);
    openAt('/stock');
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Store balance' });
    const header = h1.closest('header') as HTMLElement;
    expect(within(header).getByText(/^What is in the store\./)).toBeTruthy();
  });

  it('new sale: the header is outside both columns and there is no back link', async () => {
    loggedInAs(OWNER, { 'GET /api/products': () => json([FANTA]) });
    openAt('/sale');
    await screen.findByRole('button', { name: /Fanta/ });
    const h1 = screen.getByRole('heading', { level: 1, name: 'New sale' });
    expect(h1.closest('.sale-layout')).toBeNull();
    expect(screen.queryByRole('link', { name: /Back to home/ })).toBeNull();
  });
});

describe('loading and empty states (R2b rules 5 and 6)', () => {
  it('loading shows the skeleton and still says Loading to screen readers', async () => {
    loggedInAs(OWNER, { 'GET /api/stock?include_stopped=true': never, 'GET /api/stock-entries': never });
    openAt('/stock');
    const skeleton = await waitFor(() => {
      const found = document.querySelector('.skeleton');
      if (!found) throw new Error('no skeleton yet');
      return found as HTMLElement;
    });
    expect(skeleton.getAttribute('role')).toBe('status');
    expect(within(skeleton).getByText('Loading…')).toBeTruthy();
    const lines = skeleton.querySelectorAll('.skeleton-line');
    expect(lines.length).toBe(3);
    lines.forEach((line) => expect(line.getAttribute('aria-hidden')).toBe('true'));
  });

  it('an empty list shows its sentence and its next step (Home: New sale)', async () => {
    const summary: Summary = { date: DAY, items_sold: 0, low_stock_count: 0, last_restock: null, sales_total: 0 };
    loggedInAs(OWNER, {
      'GET /api/summary/today': () => json(summary),
      'GET /api/stock/low': () => json([]),
      [`GET /api/sales?day=${DAY}`]: () => json([]),
    });
    openAt('/');
    const sentence = await screen.findByText('No sales yet today.');
    const empty = sentence.closest('.empty-state') as HTMLElement;
    expect(within(empty).getByRole('link', { name: 'New sale' }).getAttribute('href')).toBe('/sale');
  });
});

describe('tables become cards on a phone (R2b rule 7)', () => {
  it('every store balance cell has a data-label matching its column header', async () => {
    loggedInAs(OWNER, {
      'GET /api/stock?include_stopped=true': () => json([stockLine(1, 'Fanta', 5, 'OK'), stockLine(2, 'Sprite', 2, 'LOW')]),
      'GET /api/stock-entries': () => json([]),
    });
    openAt('/stock');
    await screen.findByText('Sprite');
    const table = document.querySelector('.stock-table') as HTMLTableElement;
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    for (const row of table.querySelectorAll('tbody tr')) {
      [...row.querySelectorAll('td')].forEach((cell, i) => {
        const label = cell.getAttribute('data-label');
        // The name (first) and the Adjust button (last) need no label; every other cell names its column.
        if (label !== null) expect(label).toBe(headers[i]);
        else expect(i === 0 || cell.querySelector('a, button') !== null).toBe(true);
      });
    }
  });
});

describe('users (R2b rules 3 and 4)', () => {
  const ASHA: User = { id: 3, full_name: 'Asha Juma', username: 'asha', role: 'shopkeeper', is_locked: true, is_active: true };
  const OLD: User = { id: 4, full_name: 'Baraka Mushi', username: 'baraka', role: 'shopkeeper', is_locked: false, is_active: false };
  const NEEMA: User = { id: 5, full_name: 'Neema Said', username: 'neema', role: 'shopkeeper', is_locked: false, is_active: true };

  async function openUsers() {
    loggedInAs(OWNER, { 'GET /api/users': () => json([OWNER, ASHA, OLD, NEEMA]) });
    openAt('/users');
    await screen.findByText('Neema Said');
  }

  it('account badges read Active, Locked, Deactivated', async () => {
    await openUsers();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('Deactivated')).toBeTruthy();
    expect(screen.queryByText('ACTIVE')).toBeNull();
  });

  it('deactivate is a danger button', async () => {
    await openUsers();
    const button = screen.getByRole('button', { name: 'Deactivate Neema' });
    expect(button.className).toBe('danger-button');
  });
});
