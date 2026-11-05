// Tests for src/bill.ts. Spec: docs/specs/f05-sale.md, section 7.
import { describe, expect, it } from 'vitest';

import { addProduct, checkLine, previewTotal, stepQuantity } from '../src/bill';
import type { Product } from '../src/types';

const product = (id: number, price: number, stock: number): Product => ({
  id, name: `P${id}`, group_id: 1, group: 'Soda', own_price: null, effective_price: price,
  quantity_in_store: stock, min_level: 0, stock_status: stock === 0 ? 'OUT' : 'OK', is_active: true,
});

describe('bill', () => {
  it('adding a product twice makes one line with quantity 2', () => {
    const bill = addProduct(addProduct([], 1), 1);
    expect(bill).toEqual([{ productId: 1, quantity: '2' }]);
  });

  it('stepping down from 1 removes the line', () => {
    expect(stepQuantity([{ productId: 1, quantity: '1' }], 1, -1)).toEqual([]);
    expect(stepQuantity([{ productId: 1, quantity: '3' }], 1, -1)).toEqual([{ productId: 1, quantity: '2' }]);
  });

  it('preview line total = card price × quantity; bill total = sum of lines', () => {
    const a = checkLine({ productId: 1, quantity: '2' }, product(1, 1000, 5));
    const b = checkLine({ productId: 2, quantity: '3' }, product(2, 500, 10));
    expect(a.lineTotal).toBe(2000);
    expect(b.lineTotal).toBe(1500);
    expect(previewTotal([a, b])).toBe(3500);
  });

  it('a line above the stock gets "Item over: only N in store"; stock 0 gets "Item not available"', () => {
    expect(checkLine({ productId: 1, quantity: '6' }, product(1, 1000, 5)).problem).toBe('Item over: only 5 in store');
    expect(checkLine({ productId: 1, quantity: '1' }, product(1, 1000, 0)).problem).toBe('Item not available');
    expect(checkLine({ productId: 9, quantity: '1' }, undefined).problem).toBe('Item not available');
    expect(checkLine({ productId: 1, quantity: 'x' }, product(1, 1000, 5)).problem).toBe('The quantity must be a whole number.');
    expect(checkLine({ productId: 1, quantity: '5' }, product(1, 1000, 5)).problem).toBeNull();
  });
});
