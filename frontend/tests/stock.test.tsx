// Tests for F7, store balance and adjust stock. Spec: docs/specs/f07-stock.md, section 7.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Adjustment, StockEntry, StockLine } from '../src/types';
import { json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

const line = (
  id: number, product: string, group: string, stock: number, min: number, status: StockLine['stock_status'],
  active = true,
): StockLine => ({
  product_id: id, product, group_id: group === 'Soda' ? 1 : 2, group, quantity_in_store: stock, min_level: min,
  stock_status: status, is_active: active,
});
const FANTA = line(1, 'Fanta', 'Soda', 5, 3, 'OK');
const SPRITE = line(2, 'Sprite', 'Soda', 2, 3, 'LOW');
const COCA = line(3, 'Coca-Cola', 'Soda', 0, 3, 'OUT');
const CHOCOLATE = line(4, 'Chocolate', 'Biscuit', 10, 2, 'OK');
const OLD_JUICE = line(5, 'Old juice', 'Soda', 4, 0, 'OK', false); // stopped

const FIXES: StockEntry[] = [
  { id: 2, kind: 'adjustment', product_id: 1, product: 'Fanta', delivery_id: null, quantity_change: -2,
    reason: 'Damaged', by: 'Depot Owner', at: '2026-11-05T14:32:00' },
  { id: 1, kind: 'correction', product_id: 4, product: 'Chocolate', delivery_id: 7, quantity_change: 3,
    reason: 'Truck count was wrong', by: 'Depot Owner', at: '2026-11-04T09:05:00' },
];

const adjustment = (before: number, after: number, reason = 'Damaged'): Adjustment => ({
  id: 3, kind: 'adjustment', product_id: 1, product: 'Fanta', delivery_id: null, quantity_change: after - before,
  reason, by: 'Depot Owner', at: '2026-11-05T15:00:00', before, after,
});

type Answer = (init?: RequestInit) => Response | Promise<Response>;

function answers(extra: Record<string, Answer> = {}) {
  return {
    'GET /api/stock?include_stopped=true': () => json([FANTA, SPRITE, COCA, CHOCOLATE, OLD_JUICE]),
    'GET /api/stock-entries': () => json(FIXES),
    ...extra,
  };
}

async function openStock(user = OWNER, extra: Record<string, Answer> = {}) {
  const fetchMock = loggedInAs(user, answers(extra));
  openAt('/stock');
  await screen.findByLabelText('Search stock'); // the table has loaded
  return fetchMock;
}

async function openAdjust(extra: Record<string, Answer> = {}) {
  const fetchMock = loggedInAs(OWNER, answers(extra));
  openAt('/stock/1/adjust');
  await screen.findByLabelText('2. How many?');
  return fetchMock;
}

const table = () => screen.getByRole('table');
const rowNames = () =>
  within(table())
    .getAllByRole('row')
    .slice(1) // the header row
    .map((row) => within(row).getAllByRole('cell')[0].textContent);
const saveButton = () => screen.getByRole('button', { name: /Save adjustment|Saving…|Choose|Enter|Fix|Only/ });

function adjustments(fetchMock: ReturnType<typeof loggedInAs>): unknown[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === '/api/products/1/adjustments' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)));
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('store balance', () => {
  it('table shows every sub-item with in store, low at and status; no money anywhere', async () => {
    await openStock();
    const sprite = within(table()).getByText('Sprite').closest('tr')!;
    const cells = within(sprite).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(0, 5)).toEqual(['Sprite', 'Soda', '2', '3', 'LOW']);
    expect(rowNames()).toEqual(['Fanta', 'Sprite', 'Coca-Cola', 'Chocolate']);
    expect(screen.getByRole('main').textContent).not.toMatch(/TSh\s|price/i); // money is shown as "TSh 1,000"; the menu is not the page
  });

  it('counts OUT / LOW / OK match the list; clicking LOW shows only LOW rows', async () => {
    await openStock();
    const counts = screen.getByRole('group', { name: 'Show by status' });
    expect(within(counts).getByRole('button', { name: 'OUT: 1' })).toBeTruthy();
    expect(within(counts).getByRole('button', { name: 'LOW: 1' })).toBeTruthy();
    expect(within(counts).getByRole('button', { name: 'OK: 2' })).toBeTruthy();
    fireEvent.click(within(counts).getByRole('button', { name: 'LOW: 1' }));
    expect(rowNames()).toEqual(['Sprite']);
    fireEvent.click(within(counts).getByRole('button', { name: 'LOW: 1' })); // again = show all
    expect(rowNames()).toHaveLength(4);
  });

  it('search and item chips filter the table', async () => {
    await openStock();
    fireEvent.change(screen.getByLabelText('Search stock'), { target: { value: 'spr' } });
    expect(rowNames()).toEqual(['Sprite']);
    fireEvent.change(screen.getByLabelText('Search stock'), { target: { value: '' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter by item' })).getByRole('button', { name: 'Biscuit' }));
    expect(rowNames()).toEqual(['Chocolate']);
    expect(screen.getByRole('button', { name: 'OK: 1' })).toBeTruthy(); // counts follow the filters
  });

  it('stopped sub-items are hidden until Show stopped', async () => {
    await openStock();
    expect(within(table()).queryByText('Old juice')).toBeNull();
    fireEvent.click(screen.getByLabelText('Show stopped'));
    const row = within(table()).getByText('Old juice').closest('tr')!;
    expect(within(row).getByText('Stopped')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'Adjust Old juice' })).toBeTruthy(); // still adjustable
  });

  it('owner sees Adjust buttons and the Fixes to stock panel; shopkeeper sees neither and /stock-entries is not asked', async () => {
    await openStock(OWNER);
    expect(screen.getByRole('link', { name: 'Adjust Fanta' }).getAttribute('href')).toBe('/stock/1/adjust');
    expect(await screen.findByRole('heading', { name: 'Fixes to stock' })).toBeTruthy();
    cleanup();

    const fetchMock = await openStock(SHOPKEEPER);
    expect(screen.queryByRole('link', { name: /^Adjust/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Fixes to stock' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/stock-entries')).toBe(false);
  });

  it('shopkeeper opening /stock/1/adjust sees Owner only', async () => {
    loggedInAs(SHOPKEEPER, answers());
    openAt('/stock/1/adjust');
    expect(await screen.findByRole('heading', { name: 'This page is for the owner' })).toBeTruthy();
    expect(screen.queryByLabelText('2. How many?')).toBeNull();
  });

  it('fixes panel lists change, reason, kind, when and who, newest first', async () => {
    await openStock();
    const list = await screen.findByRole('list', { name: 'Latest fixes' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0].textContent).toContain('Fanta');
    expect(items[0].textContent).toContain('−2');
    expect(items[0].textContent).toContain('Damaged · Adjustment');
    expect(items[0].textContent).toContain('14:32 · Depot Owner');
    expect(items[1].textContent).toContain('+3');
    expect(items[1].textContent).toContain('Correction, delivery #7');
    expect(screen.getByText(/Never edited, only added/)).toBeTruthy();
  });
});

describe('adjust stock', () => {
  it('choosing Add locks Damaged, Expired and Lost; Counted differently stays open', async () => {
    await openAdjust();
    fireEvent.click(screen.getByLabelText('+ Add'));
    for (const name of [/^Damaged/, /^Expired/, /^Lost or missing/]) {
      expect((screen.getByLabelText(name) as HTMLInputElement).disabled).toBe(true);
    }
    expect((screen.getByLabelText('Counted differently') as HTMLInputElement).disabled).toBe(false);
  });

  it('switching to Add drops a reason that can only remove', async () => {
    await openAdjust();
    fireEvent.click(screen.getByLabelText('− Remove'));
    fireEvent.click(screen.getByLabelText('Damaged'));
    fireEvent.click(screen.getByLabelText('+ Add'));
    expect((screen.getByLabelText(/^Damaged/) as HTMLInputElement).checked).toBe(false);
  });

  it('no reason chosen blocks Save', async () => {
    await openAdjust();
    fireEvent.click(screen.getByLabelText('− Remove'));
    fireEvent.change(screen.getByLabelText('2. How many?'), { target: { value: '2' } });
    expect(saveButton().textContent).toBe('Choose a reason');
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('removing more than in store shows "Only N in store" and blocks Save', async () => {
    await openAdjust();
    fireEvent.click(screen.getByLabelText('− Remove'));
    fireEvent.change(screen.getByLabelText('2. How many?'), { target: { value: '6' } });
    fireEvent.click(screen.getByLabelText('Damaged'));
    expect(saveButton().textContent).toBe('Only 5 in store');
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('preview shows 5 → 3 for remove 2', async () => {
    await openAdjust();
    fireEvent.click(screen.getByLabelText('− Remove'));
    fireEvent.change(screen.getByLabelText('2. How many?'), { target: { value: '2' } });
    const preview = screen.getByRole('complementary', { name: 'After saving' });
    expect(within(preview).getByText('5')).toBeTruthy();
    expect(within(preview).getByLabelText('After').textContent).toBe('3');
  });

  it('saving sends {direction, quantity, reason} and returns to /stock with the server answer "Fanta: 4 → 2 (Damaged)"', async () => {
    // A sale happened meanwhile: the preview said 5 → 3, the server's answer says 4 → 2.
    const fetchMock = await openAdjust({ 'POST /api/products/1/adjustments': () => json(adjustment(4, 2), 201) });
    fireEvent.click(screen.getByLabelText('− Remove'));
    fireEvent.change(screen.getByLabelText('2. How many?'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Damaged'));
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect(await screen.findByText('Fanta: 4 → 2 (Damaged)')).toBeTruthy();
    expect(await screen.findByLabelText('Search stock')).toBeTruthy(); // back on the store balance
    expect(adjustments(fetchMock)).toEqual([{ direction: 'remove', quantity: 2, reason: 'Damaged' }]);
  });

  it('a 409 not_enough_stock from the server shows its message and reloads the stock', async () => {
    let stockCalls = 0;
    await openAdjust({
      'GET /api/stock?include_stopped=true': () => {
        stockCalls += 1;
        return json([{ ...FANTA, quantity_in_store: stockCalls === 1 ? 5 : 1 }]);
      },
      'POST /api/products/1/adjustments': () =>
        json({ error: 'not_enough_stock', message: 'Not enough stock: only 1 in store', product_id: 1, available: 1 }, 409),
    });
    fireEvent.click(screen.getByLabelText('− Remove'));
    fireEvent.change(screen.getByLabelText('2. How many?'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Damaged'));
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect(await screen.findByText('Not enough stock: only 1 in store')).toBeTruthy();
    await waitFor(() => expect(stockCalls).toBe(2));
    expect(await screen.findByRole('button', { name: 'Only 1 in store' })).toBeTruthy();
  });

  it('the button says Saving… and is disabled while waiting', async () => {
    await openAdjust({ 'POST /api/products/1/adjustments': () => new Promise<Response>(() => {}) });
    fireEvent.click(screen.getByLabelText('+ Add'));
    fireEvent.change(screen.getByLabelText('2. How many?'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText('Counted differently'));
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
