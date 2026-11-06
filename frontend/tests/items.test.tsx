// Tests for F8, items and prices. Spec: docs/specs/f08-items.md, section 7.
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Group, PriceHistoryEntry, Product } from '../src/types';
import { json, loggedInAs, OWNER, openAt, SHOPKEEPER } from './helpers';

const SODA: Group = { id: 1, name: 'Soda', current_price: 1000, is_active: true };
const WATER: Group = { id: 2, name: 'Water kubwa', current_price: 1000, is_active: true };
const product = (p: Partial<Product> & Pick<Product, 'id' | 'name' | 'group_id' | 'group'>): Product => ({
  own_price: null, effective_price: 1000, quantity_in_store: 0, min_level: 0, stock_status: 'OUT', is_active: true, ...p,
});
const FANTA = product({ id: 10, name: 'Fanta', group_id: 1, group: 'Soda', quantity_in_store: 5, stock_status: 'OK' });
const COCA = product({ id: 11, name: 'Coca-Cola', group_id: 1, group: 'Soda' });
const WATER_K = product({ id: 12, name: 'Water kubwa', group_id: 2, group: 'Water kubwa', own_price: 1500, effective_price: 1500, quantity_in_store: 4 });

type Answer = (init?: RequestInit) => Response | Promise<Response>;

/** The API with Soda (Fanta, Coca-Cola) and Water kubwa (own price 1,500). */
function catalog(extra: Record<string, Answer> = {}) {
  const groups = () => json([SODA, WATER]);
  const products = () => json([FANTA, COCA, WATER_K]);
  return {
    'GET /api/groups': groups,
    'GET /api/groups?include_stopped=true': groups,
    'GET /api/products': products,
    'GET /api/products?include_stopped=true': products,
    'GET /api/groups/1/price-history': () => json([]),
    'GET /api/groups/2/price-history': () => json([]),
    ...extra,
  };
}

/** Every request with this method and address, with its JSON body. */
function sent(fetchMock: ReturnType<typeof loggedInAs>, method: string, url: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([u, init]) => u === url && (init?.method ?? 'GET') === method)
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the list', () => {
  it('empty start shows "No items yet" and an Add item button', async () => {
    loggedInAs(OWNER, { 'GET /api/groups': () => json([]), 'GET /api/products': () => json([]) });
    openAt('/items');
    expect(await screen.findByText('No items yet. Add your first item.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: '+ Add item' })[0].getAttribute('href')).toBe('/items/new');
  });

  it('list shows each item with its price and sub-items, SELLING and own price or "uses item price"', async () => {
    loggedInAs(OWNER, catalog());
    openAt('/items');
    const soda = await screen.findByRole('article', { name: 'Soda' });
    expect(within(soda).getByText('TSh 1,000')).toBeTruthy();
    expect(within(soda).getByText('Fanta')).toBeTruthy();
    expect(within(soda).getByText('Uses item price TSh 1,000 · 5 in store')).toBeTruthy();
    expect(within(soda).getAllByText('SELLING')).toHaveLength(2);
    const water = screen.getByRole('article', { name: 'Water kubwa' });
    expect(within(water).getByText('Own price TSh 1,500 · 4 in store')).toBeTruthy();
  });

  it('price history panel lists entries newest first with who and when', async () => {
    const entries: PriceHistoryEntry[] = [
      { target: 'sub-item', name: 'Fanta', price: 1100, changed_at: '2026-11-03T10:00:00', changed_by: 'Depot Owner' },
      { target: 'item', name: 'Soda', price: 1000, changed_at: '2026-11-01T09:00:00', changed_by: 'Depot Owner' },
    ];
    loggedInAs(OWNER, catalog({ 'GET /api/groups/1/price-history': () => json(entries) }));
    openAt('/items');
    const panel = await screen.findByRole('region', { name: 'Soda price history' });
    const rows = await within(panel).findAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Fanta3 Nov 10:00 · Depot Owner1,100',
      'Soda (item)1 Nov 09:00 · Depot Owner1,000',
    ]);
  });
});

describe('adding and editing items', () => {
  it('adding an item sends {name, price} and shows "Soda added" on the list', async () => {
    const fetchMock = loggedInAs(OWNER, catalog({ 'POST /api/groups': () => json(SODA, 201) }));
    openAt('/items/new');
    await screen.findByLabelText('Item name'); // wait for the log-in check
    type('Item name', '  Soda ');
    type('Item price (TSh)', '1,000');
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Soda added')).toBeTruthy();
    expect(sent(fetchMock, 'POST', '/api/groups')).toEqual([{ name: 'Soda', price: 1000 }]);
  });

  it('duplicate name shows the API\'s "That name is already used"', async () => {
    loggedInAs(OWNER, catalog({
      'POST /api/groups': () => json({ error: 'name_taken', message: 'That name is already used' }, 409),
    }));
    openAt('/items/new');
    await screen.findByLabelText('Item name');
    type('Item name', 'soda');
    type('Item price (TSh)', '900');
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That name is already used');
  });

  it('bad price (letters, negative, too big) is refused before sending', async () => {
    const fetchMock = loggedInAs(OWNER, catalog());
    openAt('/items/new');
    await screen.findByLabelText('Item name');
    type('Item name', 'Juice');
    for (const bad of ['12abc', '-5', '10000001']) {
      type('Item price (TSh)', bad);
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
      expect(screen.getByRole('alert')).toBeTruthy();
    }
    expect(sent(fetchMock, 'POST', '/api/groups')).toEqual([]);
  });

  it('edit sends only the changed fields (rename sends only name)', async () => {
    const fetchMock = loggedInAs(OWNER, catalog({ 'PATCH /api/groups/1': () => json({ ...SODA, name: 'Soft drinks' }) }));
    openAt('/items/1/edit');
    await screen.findByDisplayValue('Soda');
    type('Item name', 'Soft drinks');
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Soda renamed to Soft drinks')).toBeTruthy();
    expect(sent(fetchMock, 'PATCH', '/api/groups/1')).toEqual([{ name: 'Soft drinks' }]);
  });

  it('stop selling sends is_active false; Show stopped lists it with Bring back', async () => {
    // A fake server that remembers: Soda sells until the PATCH stops it.
    let soda = SODA;
    const fetchMock = loggedInAs(OWNER, catalog({
      'PATCH /api/groups/1': () => {
        soda = { ...SODA, is_active: false };
        return json(soda);
      },
      'GET /api/groups': () => json([soda, WATER].filter((g) => g.is_active)), // stopped ones hidden
      'GET /api/groups?include_stopped=true': () => json([soda, WATER]),
    }));
    openAt('/items/1/edit');
    fireEvent.click(await screen.findByRole('button', { name: 'Stop selling Soda' }));
    expect(await screen.findByText('Soda stopped')).toBeTruthy();
    expect(sent(fetchMock, 'PATCH', '/api/groups/1')).toEqual([{ is_active: false }]);

    expect(screen.queryByRole('article', { name: 'Soda' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Show stopped'));
    const card = await screen.findByRole('article', { name: 'Soda' });
    expect(within(card).getByRole('button', { name: 'Bring back' })).toBeTruthy();
  });

  it('buttons are disabled while saving', async () => {
    loggedInAs(OWNER, catalog({ 'POST /api/groups': () => new Promise<Response>(() => {}) }));
    openAt('/items/new');
    await screen.findByLabelText('Item name');
    type('Item name', 'Juice');
    type('Item price (TSh)', '1200');
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('changing a price', () => {
  async function openConfirm(fetchMock: ReturnType<typeof loggedInAs>) {
    openAt('/items');
    const soda = await screen.findByRole('article', { name: 'Soda' });
    fireEvent.click(within(soda).getByRole('button', { name: 'Change price' }));
    type('Item price (TSh)', '1200');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    return { panel: screen.getByRole('region', { name: 'Soda: change the price?' }), fetchMock };
  }

  it('change price shows old → new and old-receipts note; nothing is sent until Yes, change', async () => {
    const fetchMock = loggedInAs(OWNER, catalog({
      'PUT /api/groups/1/price': () => json({ old_price: 1000, new_price: 1200, changed: true }),
    }));
    const { panel } = await openConfirm(fetchMock);
    expect(within(panel).getByText('1,000')).toBeTruthy();
    expect(within(panel).getByText('1,200')).toBeTruthy();
    expect(within(panel).getByText('Will sell at the new price: Fanta, Coca-Cola.')).toBeTruthy();
    expect(within(panel).getByText('Old receipts keep TSh 1,000.')).toBeTruthy();
    expect(sent(fetchMock, 'PUT', '/api/groups/1/price')).toEqual([]); // not yet!

    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, change' }));
    expect(await screen.findByText('Price of Soda changed to TSh 1,200')).toBeTruthy();
    expect(sent(fetchMock, 'PUT', '/api/groups/1/price')).toEqual([{ price: 1200 }]);
  });

  it('Cancel on the confirm step sends nothing', async () => {
    const fetchMock = loggedInAs(OWNER, catalog());
    const { panel } = await openConfirm(fetchMock);
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Soda: change the price?' })).toBeNull();
    expect(sent(fetchMock, 'PUT', '/api/groups/1/price')).toEqual([]);
  });

  it('same price again says "Nothing changed"', async () => {
    const fetchMock = loggedInAs(OWNER, catalog({
      'PUT /api/groups/1/price': () => json({ old_price: 1200, new_price: 1200, changed: false }),
    }));
    const { panel } = await openConfirm(fetchMock);
    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, change' }));
    expect(await screen.findByText('The price is already TSh 1,200. Nothing changed.')).toBeTruthy();
  });
});

describe('sub-items', () => {
  it('adding a sub-item with "Use item price" sends own_price null; with own price sends the number', async () => {
    const fetchMock = loggedInAs(OWNER, catalog({ 'POST /api/products': () => json(FANTA, 201) }));
    openAt('/items/1/new-sub-item');
    type(await screen.findByLabelText('Name').then(() => 'Name'), 'Pepsi');
    fireEvent.click(screen.getByRole('button', { name: 'Add sub-item' }));
    expect(await screen.findByText('Pepsi added to Soda')).toBeTruthy();

    cleanup();
    openAt('/items/1/new-sub-item');
    type(await screen.findByLabelText('Name').then(() => 'Name'), 'Juice');
    fireEvent.click(screen.getByRole('button', { name: /Own price/ }));
    type('Own price (TSh)', '1,300');
    type('Low-stock level', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Add sub-item' }));
    expect(await screen.findByText('Juice added to Soda')).toBeTruthy();

    expect(sent(fetchMock, 'POST', '/api/products')).toEqual([
      { group_id: 1, name: 'Pepsi', own_price: null, min_level: 0 },
      { group_id: 1, name: 'Juice', own_price: 1300, min_level: 6 },
    ]);
  });

  it('sub-item: switching to "Use item price" sends PUT price null after confirm', async () => {
    const fetchMock = loggedInAs(OWNER, catalog({
      'PUT /api/products/12/price': () => json({ old_price: 1500, new_price: null, changed: true }),
    }));
    openAt('/items/sub-items/12/edit');
    await screen.findByDisplayValue('Water kubwa');
    fireEvent.click(screen.getByRole('button', { name: /Use item price/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const panel = screen.getByRole('region', { name: 'Water kubwa: change the price?' });
    expect(within(panel).getByText('TSh 1,500')).toBeTruthy();
    expect(within(panel).getByText('Item price (TSh 1,000)')).toBeTruthy();
    expect(sent(fetchMock, 'PUT', '/api/products/12/price')).toEqual([]); // not yet!

    fireEvent.click(within(panel).getByRole('button', { name: 'Yes, change' }));
    expect(await screen.findByText('Water kubwa saved')).toBeTruthy();
    expect(sent(fetchMock, 'PUT', '/api/products/12/price')).toEqual([{ price: null }]);
    expect(sent(fetchMock, 'PATCH', '/api/products/12')).toEqual([]); // nothing else changed
  });
});

describe('owner only', () => {
  it('shopkeeper opening /items/new sees Owner only', async () => {
    loggedInAs(SHOPKEEPER, catalog());
    openAt('/items/new');
    expect(await screen.findByRole('heading', { name: 'This page is for the owner' })).toBeTruthy();
    expect(screen.queryByLabelText('Item name')).toBeNull();
  });
});
