// Tests for F5, new sale and receipt. Spec: docs/specs/f05-sale.md, section 7.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Product, Receipt } from '../src/types';
import { json, loggedInAs, OWNER, openAt } from './helpers';

const product = (id: number, name: string, group: string, price: number, stock: number): Product => ({
  id, name, group_id: id, group, own_price: null, effective_price: price, quantity_in_store: stock,
  min_level: 0, stock_status: stock === 0 ? 'OUT' : 'OK', is_active: true,
});
const FANTA = product(1, 'Fanta', 'Soda', 1000, 5);
const COCA = product(2, 'Coca-Cola', 'Soda', 1000, 0);
const CHOCOLATE = product(3, 'Chocolate', 'Biscuit', 500, 10);

const receipt = (unitPrice: number): Receipt => ({
  id: 42, sold_at: '2026-11-05T14:32:00', sold_by: 'Depot Owner', payment_method: 'cash', total: 2 * unitPrice,
  items: [{ product_id: 1, product: 'Fanta', quantity: 2, unit_price: unitPrice, line_total: 2 * unitPrice }],
});

type Answer = (init?: RequestInit) => Response | Promise<Response>;

function answers(extra: Record<string, Answer> = {}) {
  return { 'GET /api/products': () => json([FANTA, COCA, CHOCOLATE]), ...extra };
}

async function openSale(extra: Record<string, Answer> = {}) {
  const fetchMock = loggedInAs(OWNER, answers(extra));
  openAt('/sale');
  await screen.findByLabelText('Search items'); // the cards have loaded
  return fetchMock;
}

const bill = () => screen.getByRole('complementary', { name: 'The bill' });
// A product card's name starts with its item ("Soda … Fanta …"); the bill's − / + buttons do not.
const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^(Soda|Biscuit).*${name}`) });

function sales(fetchMock: ReturnType<typeof loggedInAs>): unknown[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === '/api/sales' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)));
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('picking items', () => {
  it('cards show price, stock and badge; OUT cards cannot be picked', async () => {
    await openSale();
    const fanta = card('Fanta');
    expect(within(fanta).getByText('TSh 1,000')).toBeTruthy();
    expect(within(fanta).getByText('5 in store')).toBeTruthy();
    expect(within(fanta).getByText('OK')).toBeTruthy();
    expect((card('Coca-Cola') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking a card adds it to the bill; totals appear instantly', async () => {
    await openSale();
    fireEvent.click(card('Fanta'));
    fireEvent.click(card('Fanta'));
    fireEvent.click(card('Chocolate'));
    expect((within(bill()).getByLabelText('Quantity of Fanta') as HTMLInputElement).value).toBe('2');
    expect(within(bill()).getByText('2,000')).toBeTruthy();
    expect(within(bill()).getByText('500')).toBeTruthy();
    expect(within(bill()).getByText('TSh 2,500')).toBeTruthy();
  });

  it('fast clicks in one go all count (no stale copy of the bill)', async () => {
    await openSale();
    const fanta = card('Fanta');
    const chocolate = card('Chocolate');
    // One act() = one batch: React does not redraw between these clicks, like a very fast double-tap.
    act(() => {
      fireEvent.click(fanta);
      fireEvent.click(fanta);
      fireEvent.click(chocolate);
    });
    expect((within(bill()).getByLabelText('Quantity of Fanta') as HTMLInputElement).value).toBe('2');
    expect(within(bill()).getByText('TSh 2,500')).toBeTruthy();
  });

  it('search and item chips filter the cards', async () => {
    await openSale();
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: 'CHOC' } });
    expect(screen.queryByRole('button', { name: /Fanta/ })).toBeNull();
    expect(card('Chocolate')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soda' }));
    expect(screen.queryByRole('button', { name: /Chocolate/ })).toBeNull();
    expect(card('Fanta')).toBeTruthy();
  });
});

describe('the bill', () => {
  it('typing a quantity above stock marks the line and blocks Confirm', async () => {
    await openSale();
    fireEvent.click(card('Fanta'));
    fireEvent.change(within(bill()).getByLabelText('Quantity of Fanta'), { target: { value: '6' } });
    expect(within(bill()).getByText('Item over: only 5 in store')).toBeTruthy();
    const button = within(bill()).getByRole('button', { name: 'Fix the red line to confirm' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('Confirm needs a payment method', async () => {
    await openSale();
    fireEvent.click(card('Fanta'));
    expect((within(bill()).getByRole('button', { name: 'Choose how the customer paid' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(bill()).getByLabelText('Mobile money'));
    expect((within(bill()).getByRole('button', { name: 'Confirm sale' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('the bill survives going to another page and back; Clear empties it', async () => {
    await openSale();
    fireEvent.click(card('Fanta'));
    cleanup(); // leave the page
    openAt('/sale'); // come back (same tab)
    await screen.findByLabelText('Search items');
    expect((within(bill()).getByLabelText('Quantity of Fanta') as HTMLInputElement).value).toBe('1');
    fireEvent.click(within(bill()).getByRole('button', { name: 'Clear' }));
    expect(within(bill()).getByText('Tap an item to add it.')).toBeTruthy();
    expect(sessionStorage.getItem('depot-bill')).toBeNull();
  });
});

describe('confirming', () => {
  async function sellTwoFanta(extra: Record<string, Answer>) {
    const fetchMock = await openSale(extra);
    fireEvent.click(card('Fanta'));
    fireEvent.click(card('Fanta'));
    fireEvent.click(within(bill()).getByLabelText('Cash'));
    fireEvent.click(within(bill()).getByRole('button', { name: 'Confirm sale' }));
    return fetchMock;
  }

  it('the request contains only product_id, quantity and payment_method: no price, no total', async () => {
    const fetchMock = await sellTwoFanta({
      'POST /api/sales': () => json(receipt(1000), 201),
      'GET /api/sales/42': () => json(receipt(1000)),
    });
    await screen.findByText('Receipt #42');
    expect(sales(fetchMock)).toEqual([{ payment_method: 'cash', items: [{ product_id: 1, quantity: 2 }] }]);
    expect(JSON.stringify(sales(fetchMock))).not.toMatch(/price|total/);
  });

  it("after confirming, the receipt page shows the server's prices and total", async () => {
    await sellTwoFanta({
      'POST /api/sales': () => json(receipt(1000), 201),
      'GET /api/sales/42': () => json(receipt(1000)),
    });
    const card42 = await screen.findByRole('article', { name: 'Receipt #42' });
    expect(within(card42).getByText('1,000')).toBeTruthy();
    expect(within(card42).getAllByText('2,000')).toHaveLength(2); // line total and bill total
    expect(within(card42).getByText('Depot Owner')).toBeTruthy();
    expect(screen.queryByText(/A price changed/)).toBeNull();
    expect(sessionStorage.getItem('depot-bill')).toBeNull(); // the bill is cleared after the sale
  });

  it("a price changed since opening: the receipt shows the server's price and the note", async () => {
    await sellTwoFanta({
      'POST /api/sales': () => json(receipt(1200), 201),
      'GET /api/sales/42': () => json(receipt(1200)),
    });
    expect(await screen.findByText('A price changed since the sale screen was opened. This receipt shows the price used.')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Receipt #42' })).getAllByText('2,400')).toHaveLength(2);
  });

  it('a 409 item_over from the server marks that line, shows the message and reloads the stock', async () => {
    let productCalls = 0;
    await sellTwoFanta({
      'GET /api/products': () => {
        productCalls += 1;
        return json([{ ...FANTA, quantity_in_store: productCalls === 1 ? 5 : 1 }, COCA, CHOCOLATE]);
      },
      'POST /api/sales': () =>
        json({ error: 'item_over', message: 'Item over: only 1 in store', product_id: 1, available: 1 }, 409),
    });
    expect(await within(bill()).findByText('Item over: only 1 in store')).toBeTruthy();
    await waitFor(() => expect(productCalls).toBe(2)); // the reload happens just after the message
    expect(within(bill()).getByRole('button', { name: 'Fix the red line to confirm' })).toBeTruthy();
  });

  it('the button says Saving… and is disabled while waiting', async () => {
    await sellTwoFanta({ 'POST /api/sales': () => new Promise<Response>(() => {}) });
    expect((within(bill()).getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the receipt page', () => {
  it('the receipt page loads by its address (refresh) and Next customer opens an empty sale', async () => {
    loggedInAs(OWNER, answers({ 'GET /api/sales/42': () => json(receipt(1000)) }));
    openAt('/receipt/42');
    expect(await screen.findByText('Receipt #42')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Next customer/ }).getAttribute('href')).toBe('/sale');
    expect(screen.getByRole('link', { name: 'Done' }).getAttribute('href')).toBe('/');
  });
});
