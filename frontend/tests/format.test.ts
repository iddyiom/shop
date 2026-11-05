// Tests for src/format.ts. Spec: docs/specs/f04-home.md, section 7.
import { describe, expect, it } from 'vitest';

import { formatTsh, itemsSummary, shortDate, timeOf } from '../src/format';

describe('format', () => {
  it('formatTsh adds thousands separators', () => {
    expect(formatTsh(184500)).toBe('184,500');
    expect(formatTsh(0)).toBe('0');
    expect(formatTsh(1500)).toBe('1,500');
  });

  it('timeOf reads HH:MM without time zone conversion', () => {
    expect(timeOf('2026-11-05T14:32:00')).toBe('14:32');
    expect(timeOf('2026-11-05T00:05:59')).toBe('00:05');
  });

  it('shortDate turns 2026-11-01 into 1 Nov', () => {
    expect(shortDate('2026-11-01')).toBe('1 Nov');
    expect(shortDate('2027-01-31')).toBe('31 Jan');
  });

  it('itemsSummary joins lines as "2 Fanta, 1 Chocolate"', () => {
    const lines = [
      { product_id: 1, product: 'Fanta', quantity: 2, unit_price: 1000, line_total: 2000 },
      { product_id: 2, product: 'Chocolate', quantity: 1, unit_price: 500, line_total: 500 },
    ];
    expect(itemsSummary(lines)).toBe('2 Fanta, 1 Chocolate');
  });
});
