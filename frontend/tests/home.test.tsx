// Tests for F4, Home. Spec: docs/specs/f04-home.md, section 7.
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Receipt, StockLine, Summary } from '../src/types';
import { json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

const DAY = '2026-11-05';

const OWNER_SUMMARY: Summary = {
  date: DAY, items_sold: 126, low_stock_count: 2, last_restock: '2026-11-01', sales_total: 184500,
};
// The shopkeeper's answer has no sales_total key at all (backend unit 8).
const SHOP_SUMMARY: Summary = { date: DAY, items_sold: 126, low_stock_count: 2, last_restock: '2026-11-01' };

const LOW: StockLine[] = [
  { product_id: 2, product: 'Coca-Cola', group_id: 1, group: 'Soda', quantity_in_store: 0, min_level: 6, stock_status: 'OUT', is_active: true },
  { product_id: 1, product: 'Fanta', group_id: 1, group: 'Soda', quantity_in_store: 3, min_level: 6, stock_status: 'LOW', is_active: true },
];

const SALES: Receipt[] = [
  {
    id: 42, sold_at: `${DAY}T14:32:00`, sold_by: 'Shop Keeper', payment_method: 'cash', total: 2500,
    items: [
      { product_id: 1, product: 'Fanta', quantity: 2, unit_price: 1000, line_total: 2000 },
      { product_id: 3, product: 'Chocolate', quantity: 1, unit_price: 500, line_total: 500 },
    ],
  },
];

function homeAnswers(summary: Summary, overrides: Record<string, () => Response | Promise<Response>> = {}) {
  return {
    'GET /api/summary/today': () => json(summary),
    'GET /api/stock/low': () => json(LOW),
    [`GET /api/sales?day=${DAY}`]: () => json(SALES),
    ...overrides,
  };
}

function region(name: string) {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Home', () => {
  it('owner sees the 4 cards with formatted money: Sales today TSh 184,500', async () => {
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY));
    openAt('/');
    const cards = await screen.findByRole('region', { name: 'Today in numbers' });
    expect(within(cards).getByText('Sales today')).toBeTruthy();
    expect(within(cards).getByText('TSh 184,500')).toBeTruthy();
    expect(within(cards).getByText('126')).toBeTruthy();
    expect(within(cards).getByText('1 Nov')).toBeTruthy();
  });

  it("shopkeeper sees 3 cards and no day total (receipt rows still show each receipt's own total)", async () => {
    loggedInAs(SHOPKEEPER, homeAnswers(SHOP_SUMMARY));
    openAt('/');
    const cards = await screen.findByRole('region', { name: 'Today in numbers' });
    expect(within(cards).queryByText('Sales today')).toBeNull();
    expect(screen.queryByText(/184,500/)).toBeNull();
    expect(within(cards).getByText('Items sold')).toBeTruthy();
    expect(await screen.findByText('Tell the owner: running low')).toBeTruthy();
  });

  it("sales are asked for the server's date, not the laptop's", async () => {
    const odd = { ...OWNER_SUMMARY, date: '2031-02-03' };
    const fetchMock = loggedInAs(OWNER, homeAnswers(odd, { 'GET /api/sales?day=2031-02-03': () => json([]) }));
    openAt('/');
    expect(await screen.findByText('No sales yet today.')).toBeTruthy();
    const salesCalls = fetchMock.mock.calls.map(([url]) => url).filter((url) => url.startsWith('/api/sales'));
    expect(salesCalls).toEqual(['/api/sales?day=2031-02-03']);
  });

  it('needs restocking lists OUT and LOW with badges and how many left', async () => {
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY));
    openAt('/');
    await screen.findByText('Coca-Cola');
    const list = region('Needs restocking');
    expect(within(list).getByText('OUT')).toBeTruthy();
    expect(within(list).getByText('LOW')).toBeTruthy();
    expect(within(list).getByText('0 left')).toBeTruthy();
    expect(within(list).getByText('3 left · low at 6')).toBeTruthy();
  });

  it('latest sales shows time 14:32, sold by, items summary, paid and total', async () => {
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY));
    openAt('/');
    await screen.findByText('14:32');
    const latest = region('Latest sales');
    expect(within(latest).getByText('Shop Keeper')).toBeTruthy();
    expect(within(latest).getByText('2 Fanta, 1 Chocolate')).toBeTruthy();
    expect(within(latest).getByText('Cash')).toBeTruthy();
    expect(within(latest).getByText('2,500')).toBeTruthy();
  });

  it('empty day: "No sales yet today.", "Nothing is low or out.", LAST RESTOCK "None yet"', async () => {
    const empty = { ...OWNER_SUMMARY, items_sold: 0, low_stock_count: 0, last_restock: null, sales_total: 0 };
    loggedInAs(OWNER, homeAnswers(empty, {
      'GET /api/stock/low': () => json([]),
      [`GET /api/sales?day=${DAY}`]: () => json([]),
    }));
    openAt('/');
    expect(await screen.findByText('No sales yet today.')).toBeTruthy();
    expect(await screen.findByText('Nothing is low or out.')).toBeTruthy();
    expect(screen.getByText('None yet')).toBeTruthy();
  });

  it('a failed panel shows the API message and Try again reloads it; other panels still show', async () => {
    let lowCalls = 0;
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY, {
      'GET /api/stock/low': () => {
        lowCalls += 1;
        return lowCalls === 1 ? new Response('down', { status: 503 }) : json(LOW);
      },
    }));
    openAt('/');
    expect(await screen.findByText('Cannot reach the API. Is it running?')).toBeTruthy();
    expect(await screen.findByText('TSh 184,500')).toBeTruthy(); // the cards still work
    fireEvent.click(within(region('Needs restocking')).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Coca-Cola')).toBeTruthy();
  });

  it('All sales and Store balance links go to /sales and /stock', async () => {
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY));
    openAt('/');
    await screen.findByText('14:32');
    expect(within(region('Latest sales')).getByRole('link', { name: 'See all' }).getAttribute('href')).toBe('/sales');
    expect(within(region('Needs restocking')).getByRole('link', { name: 'Store balance' }).getAttribute('href')).toBe('/stock');
  });

  it('quick actions: New sale, Receive stock, Store balance (R1 spec, section 11)', async () => {
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY));
    openAt('/');
    const actions = await screen.findByRole('navigation', { name: 'Quick actions' });
    const links = within(actions).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([['New sale', '/sale'], ['Receive stock', '/receive'], ['Store balance', '/stock']]);
  });

  it('card lines are counted from the data on the page: receipts, out and low, days since the restock', async () => {
    loggedInAs(OWNER, homeAnswers(OWNER_SUMMARY));
    openAt('/');
    const cards = await screen.findByRole('region', { name: 'Today in numbers' });
    expect(await within(cards).findByText('From 1 receipt')).toBeTruthy();
    expect(await within(cards).findByText('1 out, 1 running low')).toBeTruthy();
    expect(within(cards).getByText('4 days ago')).toBeTruthy(); // 1 Nov, and the server's today is 5 Nov
  });
});
