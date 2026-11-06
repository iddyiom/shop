// Tests for F9, sales records and restock history. Spec: docs/specs/f09-records.md, section 7.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Correction, Delivery, Receipt, Summary } from '../src/types';
import { json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

const TODAY = '2026-11-05';
const SUMMARY: Summary = { date: TODAY, items_sold: 3, low_stock_count: 0, last_restock: null };

const receipt = (id: number, time: string, total: number): Receipt => ({
  id, sold_at: `${TODAY}T${time}:00`, sold_by: 'Shop Keeper', payment_method: 'cash', total,
  items: [{ product_id: 1, product: 'Fanta', quantity: total / 1000, unit_price: 1000, line_total: total }],
});
const TODAY_SALES = [receipt(42, '14:32', 3000), receipt(41, '09:05', 2000)];
const YESTERDAY_SALES = [{ ...receipt(30, '16:00', 5000), sold_at: '2026-11-04T16:00:00' }];

type Answer = (init?: RequestInit) => Response | Promise<Response>;

function salesAnswers(extra: Record<string, Answer> = {}) {
  return {
    'GET /api/summary/today': () => json(SUMMARY),
    [`GET /api/sales?day=${TODAY}`]: () => json(TODAY_SALES),
    'GET /api/sales?day=2026-11-04': () => json(YESTERDAY_SALES),
    'GET /api/sales?day=2026-10-20': () => json([]),
    ...extra,
  };
}

async function openSales(user = OWNER, path = '/sales') {
  const fetchMock = loggedInAs(user, salesAnswers());
  const router = openAt(path);
  await screen.findByRole('heading', { name: /November|October/ });
  return { fetchMock, router };
}

const salesAsked = (fetchMock: ReturnType<typeof loggedInAs>) =>
  fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/sales'));

// ---------- Restock history ----------

const delivery = (id: number, date: string, withCorrection: boolean, owner: boolean): Delivery => ({
  id, delivered_at: date, received_by: 'Depot Owner', note: id === 7 ? 'Morning truck' : null,
  items: [
    { product_id: 1, product: 'Fanta', quantity: 48, ...(owner ? { buying_price: 780 } : {}) },
    { product_id: 2, product: 'Sprite', quantity: 24, ...(owner ? { buying_price: null } : {}) },
  ],
  corrections: withCorrection
    ? [{ id: 1, product_id: 1, product: 'Fanta', quantity_change: -2, reason: 'Counted again, truck brought 46',
        by: 'Depot Owner', at: '2026-11-01T10:40:00' }]
    : [],
});

function restockAnswers(owner: boolean, extra: Record<string, Answer> = {}) {
  const d7 = delivery(7, '2026-11-01', true, owner);
  const d6 = delivery(6, '2026-10-27', false, owner);
  return {
    'GET /api/deliveries': () => json([d7, d6]),
    'GET /api/deliveries/7': () => json(d7),
    'GET /api/deliveries/6': () => json(d6),
    'GET /api/deliveries/99': () => json({ error: 'not_found', message: 'Delivery not found' }, 404),
    ...extra,
  };
}

async function openRestock(user = OWNER, path = '/restock', extra: Record<string, Answer> = {}) {
  const fetchMock = loggedInAs(user, restockAnswers(user.role === 'owner', extra));
  const router = openAt(path);
  await screen.findByRole('navigation', { name: 'Deliveries' });
  return { fetchMock, router };
}

const deliveryTable = () => screen.getByRole('table');
const correctButton = () => within(screen.getByRole('region', { name: 'Correct a line' })).getByRole('button');

function fillCorrection(product: string, direction: '− Remove' | '+ Add', quantity: string, reason: string) {
  fireEvent.change(screen.getByLabelText('Sub-item on this delivery'), { target: { value: product } });
  fireEvent.click(screen.getByLabelText(direction));
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: quantity } });
  fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: reason } });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sales records', () => {
  it("opens on the server's today (not the laptop's) and lists its receipts, newest first", async () => {
    // The laptop's clock says 7 November; the server says 5 November. The server wins.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T08:00:00Z'));
    await openSales();
    expect(screen.getByRole('heading', { name: 'Thursday 5 November' })).toBeTruthy();
    expect(await screen.findByText('2 receipts')).toBeTruthy();
    const ids = within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent);
    expect(ids).toEqual(['#42', '#41']);
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Yesterday and the date picker ask /sales?day= for that day and put it in the address', async () => {
    const { fetchMock, router } = await openSales();
    fireEvent.click(screen.getByRole('button', { name: 'Yesterday' }));
    expect(await screen.findByRole('heading', { name: 'Wednesday 4 November' })).toBeTruthy();
    expect(await screen.findByText('1 receipt')).toBeTruthy();
    expect(router.state.location.search).toBe('?day=2026-11-04');
    fireEvent.change(screen.getByLabelText('Pick a date'), { target: { value: '2026-10-20' } });
    expect(await screen.findByRole('heading', { name: 'Tuesday 20 October' })).toBeTruthy();
    expect(salesAsked(fetchMock)).toContain('/api/sales?day=2026-10-20');
    expect((screen.getByLabelText('Pick a date') as HTMLInputElement).max).toBe(TODAY);
  });

  it('opening /sales?day=2026-11-04 shows that day (refresh keeps the day)', async () => {
    await openSales(OWNER, '/sales?day=2026-11-04');
    expect(screen.getByRole('heading', { name: 'Wednesday 4 November' })).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Receipt #30' })).toBeTruthy();
  });

  it('a future day in the address shows a message and does not ask the API', async () => {
    const fetchMock = loggedInAs(OWNER, salesAnswers());
    openAt('/sales?day=2026-11-06');
    expect(await screen.findByText('Pick today or an earlier day.')).toBeTruthy();
    expect(salesAsked(fetchMock)).toEqual([]);
  });

  it('a receipt row links to /receipt/:id', async () => {
    await openSales();
    expect((await screen.findByRole('link', { name: 'Receipt #42' })).getAttribute('href')).toBe('/receipt/42');
  });

  it("owner sees the day's money total; shopkeeper sees the receipt count but no day total", async () => {
    await openSales(OWNER);
    expect((await screen.findByLabelText('Day total')).textContent).toBe('TSh 5,000'); // 3,000 + 2,000
    cleanup();
    await openSales(SHOPKEEPER);
    expect(await screen.findByText('2 receipts')).toBeTruthy();
    expect(screen.queryByLabelText('Day total')).toBeNull();
    expect(screen.queryByText('Owner only')).toBeNull();
  });

  it('an empty day says "No sales on this day."', async () => {
    await openSales(OWNER, '/sales?day=2026-10-20');
    expect(await screen.findByText('No sales on this day.')).toBeTruthy();
  });
});

describe('restock history', () => {
  it('opens the newest delivery; clicking another opens /restock/:id', async () => {
    const { router } = await openRestock();
    expect(await screen.findByRole('heading', { name: 'Delivery of Sunday 1 November' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /27 Oct/ }));
    expect(await screen.findByRole('heading', { name: 'Delivery of Tuesday 27 October' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/restock/6');
  });

  it('delivery table shows delivered, corrections and recorded now; corrections listed with reason, when, who', async () => {
    await openRestock(OWNER, '/restock/7');
    await screen.findByRole('heading', { name: 'Delivery of Sunday 1 November' });
    const fanta = within(deliveryTable()).getByText('Fanta').closest('tr')!;
    expect(within(fanta).getAllByRole('cell').map((c) => c.textContent).slice(0, 4)).toEqual(['Fanta', '48', '−2', '46']);
    const fixes = screen.getByRole('list', { name: 'Corrections on this delivery' });
    expect(fixes.textContent).toContain('Counted again, truck brought 46');
    expect(fixes.textContent).toContain('1 Nov 10:40 · Depot Owner');
    expect(screen.getByText('Never edited')).toBeTruthy();
  });

  it('owner sees buying prices and the correction form; shopkeeper sees neither', async () => {
    await openRestock(OWNER, '/restock/7');
    await screen.findByRole('heading', { name: /Delivery of/ });
    expect(within(deliveryTable()).getByText('780')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Correct a line' })).toBeTruthy();
    cleanup();
    await openRestock(SHOPKEEPER, '/restock/7');
    await screen.findByRole('heading', { name: /Delivery of/ });
    expect(within(deliveryTable()).queryByText(/Buying price/)).toBeNull();
    expect(within(deliveryTable()).queryByText('780')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Correct a line' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Corrections on this delivery' })).toBeTruthy(); // history is for everyone
  });

  it('correction: only sub-items on this delivery can be chosen', async () => {
    await openRestock(OWNER, '/restock/7');
    const select = await screen.findByLabelText('Sub-item on this delivery');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose…', 'Fanta (46 recorded)', 'Sprite (24 recorded)']);
  });

  it('correction: no reason blocks Save; removing more than recorded shows "Only N recorded on this delivery"', async () => {
    await openRestock(OWNER, '/restock/7');
    await screen.findByLabelText('Sub-item on this delivery');
    fillCorrection('1', '− Remove', '2', '');
    expect(correctButton().textContent).toBe('Write the reason');
    expect((correctButton() as HTMLButtonElement).disabled).toBe(true);
    fillCorrection('1', '− Remove', '47', 'Counted again');
    expect(correctButton().textContent).toBe('Only 46 recorded on this delivery');
    expect((correctButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("correction: saving sends {product_id, quantity_change: -2, reason}, reloads the delivery and shows the server's note", async () => {
    let detailCalls = 0;
    const saved: Correction = {
      id: 2, delivery_id: 7, product_id: 2, product: 'Sprite', quantity_change: -2, reason: 'Two were empty',
      by: 'Depot Owner', at: '2026-11-05T15:00:00', before: 30, after: 28,
    };
    const { fetchMock } = await openRestock(OWNER, '/restock/7', {
      'GET /api/deliveries/7': () => {
        detailCalls += 1;
        return json(delivery(7, '2026-11-01', true, true));
      },
      'POST /api/deliveries/7/corrections': () => json(saved, 201),
    });
    await screen.findByLabelText('Sub-item on this delivery');
    fillCorrection('2', '− Remove', '2', '  Two were empty ');
    fireEvent.click(screen.getByRole('button', { name: 'Add correction' }));
    expect(await screen.findByText('Sprite: −2 on this delivery. Stock 30 → 28.')).toBeTruthy();
    await waitFor(() => expect(detailCalls).toBe(2));
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
    expect(posts.map(([url, init]) => [url, init?.method, JSON.parse(String(init?.body))])).toEqual([
      ['/api/deliveries/7/corrections', 'POST', { product_id: 2, quantity_change: -2, reason: 'Two were empty' }],
    ]);
  });

  it('correction: a 409 from the server shows its message and reloads the delivery', async () => {
    let detailCalls = 0;
    await openRestock(OWNER, '/restock/7', {
      'GET /api/deliveries/7': () => {
        detailCalls += 1;
        return json(delivery(7, '2026-11-01', true, true));
      },
      'POST /api/deliveries/7/corrections': () =>
        json({ error: 'not_enough_stock', message: 'Not enough stock: only 1 in store', available: 1 }, 409),
    });
    await screen.findByLabelText('Sub-item on this delivery');
    fillCorrection('2', '− Remove', '5', 'Recount');
    fireEvent.click(screen.getByRole('button', { name: 'Add correction' }));
    expect(await screen.findByText('Not enough stock: only 1 in store')).toBeTruthy();
    await waitFor(() => expect(detailCalls).toBe(2));
  });

  it('correction: the button says Saving… and is disabled while waiting', async () => {
    await openRestock(OWNER, '/restock/7', {
      'POST /api/deliveries/7/corrections': () => new Promise<Response>(() => {}),
    });
    await screen.findByLabelText('Sub-item on this delivery');
    fillCorrection('1', '+ Add', '1', 'Found one more');
    fireEvent.click(screen.getByRole('button', { name: 'Add correction' }));
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('an unknown delivery id shows "Delivery not found"', async () => {
    await openRestock(OWNER, '/restock/99');
    expect(await screen.findByRole('heading', { name: 'Delivery not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /1 Nov/ })).toBeTruthy(); // the list is still there
  });
});
