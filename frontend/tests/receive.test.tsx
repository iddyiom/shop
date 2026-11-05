// Tests for F6, receive stock. Spec: docs/specs/f06-receive.md, section 7.
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Delivery, Product, Summary } from '../src/types';
import { json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

const TODAY = '2026-11-05';
const SUMMARY: Summary = { date: TODAY, items_sold: 0, low_stock_count: 0, last_restock: null };
const product = (id: number, name: string, group: string, stock: number): Product => ({
  id, name, group_id: group === 'Soda' ? 1 : 2, group, own_price: null, effective_price: 1000,
  quantity_in_store: stock, min_level: 0, stock_status: stock === 0 ? 'OUT' : 'OK', is_active: true,
});
const FANTA = product(1, 'Fanta', 'Soda', 3);
const SPRITE = product(2, 'Sprite', 'Soda', 0);
const CHOCOLATE = product(3, 'Chocolate', 'Biscuit', 10);

type Answer = (init?: RequestInit) => Response | Promise<Response>;

function answers(extra: Record<string, Answer> = {}) {
  return {
    'GET /api/summary/today': () => json(SUMMARY),
    'GET /api/products': () => json([FANTA, SPRITE, CHOCOLATE]),
    'GET /api/deliveries': () => json([]),
    ...extra,
  };
}

const savedDelivery = (items: Delivery['items']): Delivery => ({
  id: 7, delivered_at: TODAY, received_by: 'Depot Owner', note: null, items, corrections: [],
});

function sentDeliveries(fetchMock: ReturnType<typeof loggedInAs>): unknown[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === '/api/deliveries' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)));
}

/** Fill line n (1-based): sub-item, quantity and (owner) buying price. */
function fillLine(n: number, productName: string, quantity: string, buyingPrice?: string) {
  const select = screen.getByLabelText(`Sub-item, line ${n}`) as HTMLSelectElement;
  const option = within(select).getByRole('option', { name: productName }) as HTMLOptionElement;
  fireEvent.change(select, { target: { value: option.value } });
  fireEvent.change(screen.getByLabelText(`Quantity, line ${n}`), { target: { value: quantity } });
  if (buyingPrice !== undefined) {
    fireEvent.change(screen.getByLabelText(`Buying price, line ${n}`), { target: { value: buyingPrice } });
  }
}

async function openAs(user: typeof OWNER, extra: Record<string, Answer> = {}) {
  const fetchMock = loggedInAs(user, answers(extra));
  openAt('/receive');
  await screen.findByLabelText('Sub-item, line 1');
  return fetchMock;
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save delivery' }));
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the form', () => {
  it("the date starts on the server's today and cannot go past it", async () => {
    await openAs(OWNER);
    const date = screen.getByLabelText('Delivery date') as HTMLInputElement;
    expect(date.type).toBe('date');
    expect(date.value).toBe(TODAY);
    expect(date.max).toBe(TODAY);
  });

  it('owner sees the buying price column; shopkeeper has no such column at all', async () => {
    await openAs(OWNER);
    expect(screen.getByText(/Buying price each \(TSh\)/)).toBeTruthy();
    expect(screen.getByLabelText('Buying price, line 1')).toBeTruthy();
    cleanup();

    await openAs(SHOPKEEPER);
    expect(screen.queryByText(/Buying price/)).toBeNull();
    expect(screen.queryByLabelText('Buying price, line 1')).toBeNull();
  });

  it('the sub-item list shows active sub-items grouped by item', async () => {
    await openAs(OWNER);
    const select = screen.getByLabelText('Sub-item, line 1');
    const groups = [...select.querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual(['Soda', 'Biscuit']);
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose…', 'Fanta', 'Sprite', 'Chocolate',
    ]);
  });

  it('Add another line and remove (×) work; the last line cannot be removed', async () => {
    await openAs(OWNER);
    expect((screen.getByRole('button', { name: 'Remove line 1' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '+ Add another line' }));
    expect(screen.getByLabelText('Sub-item, line 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.queryByLabelText('Sub-item, line 2')).toBeNull();
  });
});

describe('the preview', () => {
  it('stock preview shows "3 → 51" and units arriving', async () => {
    await openAs(OWNER);
    fillLine(1, 'Fanta', '48');
    const preview = screen.getByRole('region', { name: 'Stock after saving' });
    expect(within(preview).getByText('Fanta')).toBeTruthy();
    expect(within(preview).getByText('3 →', { exact: false })).toBeTruthy();
    expect(within(preview).getByText('51')).toBeTruthy();
    expect(within(preview).getByText('48')).toBeTruthy(); // units arriving
  });

  it('the same sub-item on two lines adds both in the preview', async () => {
    await openAs(OWNER);
    fillLine(1, 'Fanta', '48');
    fireEvent.click(screen.getByRole('button', { name: '+ Add another line' }));
    fillLine(2, 'Fanta', '2');
    const preview = screen.getByRole('region', { name: 'Stock after saving' });
    expect(within(preview).getByText('53')).toBeTruthy(); // 3 + 48 + 2
    expect(within(preview).getByText('50')).toBeTruthy(); // units arriving
  });
});

describe('saving', () => {
  it('saving sends {delivered_at, note, items} with buying_price only for the owner and only when typed', async () => {
    const fetchMock = await openAs(OWNER, {
      'POST /api/deliveries': () => json(savedDelivery([
        { product_id: 1, product: 'Fanta', quantity: 48, buying_price: 780 },
        { product_id: 3, product: 'Chocolate', quantity: 24, buying_price: null },
      ]), 201),
    });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: ' Morning truck ' } });
    fillLine(1, 'Fanta', '48', '780');
    fireEvent.click(screen.getByRole('button', { name: '+ Add another line' }));
    fillLine(2, 'Chocolate', '24', '');
    save();
    await screen.findByText('Delivery saved: 2 lines, 72 units');
    expect(sentDeliveries(fetchMock)).toEqual([{
      delivered_at: TODAY,
      note: 'Morning truck',
      items: [
        { product_id: 1, quantity: 48, buying_price: 780 },
        { product_id: 3, quantity: 24 }, // no price typed: no buying_price key
      ],
    }]);
  });

  it("a shopkeeper's save never contains buying_price", async () => {
    const fetchMock = await openAs(SHOPKEEPER, {
      'POST /api/deliveries': () => json(savedDelivery([{ product_id: 1, product: 'Fanta', quantity: 6 }]), 201),
    });
    fillLine(1, 'Fanta', '6');
    save();
    await screen.findByText('Delivery saved: 1 line, 6 units');
    expect(JSON.stringify(sentDeliveries(fetchMock))).not.toContain('buying_price');
  });

  it('after saving: success note, form reset, stock reloaded from the API', async () => {
    let productCalls = 0;
    await openAs(OWNER, {
      'GET /api/products': () => {
        productCalls += 1;
        return json([{ ...FANTA, quantity_in_store: productCalls === 1 ? 3 : 51 }, SPRITE, CHOCOLATE]);
      },
      'POST /api/deliveries': () => json(savedDelivery([{ product_id: 1, product: 'Fanta', quantity: 48 }]), 201),
    });
    fillLine(1, 'Fanta', '48');
    save();
    await screen.findByText('Delivery saved: 1 line, 48 units');
    expect((screen.getByLabelText('Sub-item, line 1') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Delivery date') as HTMLInputElement).value).toBe(TODAY); // date stays
    expect(productCalls).toBe(2); // asked the server again
  });

  it("a refused save (item stopped) shows the API's message and keeps the form", async () => {
    await openAs(OWNER, {
      'POST /api/deliveries': () =>
        json({ error: 'item_stopped', message: 'Fanta is stopped. Bring it back first.' }, 409),
    });
    fillLine(1, 'Fanta', '48');
    save();
    expect((await screen.findByRole('alert')).textContent).toBe('Fanta is stopped. Bring it back first.');
    expect((screen.getByLabelText('Quantity, line 1') as HTMLInputElement).value).toBe('48');
  });

  it('quick checks: no sub-item, quantity 0 or "abc", bad buying price; the line is named; nothing sent', async () => {
    const fetchMock = await openAs(OWNER);
    save();
    expect(screen.getByRole('alert').textContent).toBe('Line 1: choose a sub-item.');
    fillLine(1, 'Fanta', '0');
    save();
    expect(screen.getByRole('alert').textContent).toBe('Line 1: the quantity must be at least 1.');
    fillLine(1, 'Fanta', 'abc');
    save();
    expect(screen.getByRole('alert').textContent).toBe('Line 1: the quantity must be a whole number.');
    fillLine(1, 'Fanta', '5', '-3');
    save();
    expect(screen.getByRole('alert').textContent).toMatch(/^Line 1: use whole shillings/);
    expect(sentDeliveries(fetchMock)).toEqual([]);
  });

  it('the button says Saving… and is disabled while waiting', async () => {
    await openAs(OWNER, { 'POST /api/deliveries': () => new Promise<Response>(() => {}) });
    fillLine(1, 'Fanta', '1');
    save();
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('around the form', () => {
  it('no items yet: owner gets a link to Items and prices', async () => {
    loggedInAs(OWNER, answers({ 'GET /api/products': () => json([]) }));
    openAt('/receive');
    expect(await screen.findByText('No items yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Items and prices' }).getAttribute('href')).toBe('/items');
  });

  it('Last deliveries shows date, lines, units and who received', async () => {
    await openAs(OWNER, {
      'GET /api/deliveries': () => json([
        { ...savedDelivery([
          { product_id: 1, product: 'Fanta', quantity: 48 },
          { product_id: 3, product: 'Chocolate', quantity: 24 },
        ]), delivered_at: '2026-11-01' },
      ]),
    });
    const panel = screen.getByRole('region', { name: 'Last deliveries' });
    expect(await within(panel).findByText('1 Nov')).toBeTruthy();
    expect(within(panel).getByText('2 lines · 72 units')).toBeTruthy();
    expect(within(panel).getByText('Depot Owner')).toBeTruthy();
  });
});
