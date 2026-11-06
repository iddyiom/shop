// Tests for src/format.ts. Specs: docs/specs/f04-home.md and f09-records.md, section 7.
import { describe, expect, it } from 'vitest';

import { dayBefore, daysAgo, formatTsh, itemsSummary, longDate, shortDate, timeOf } from '../src/format';

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

  it('dayBefore steps back one day, across month ends and leap years', () => {
    expect(dayBefore('2026-11-05')).toBe('2026-11-04');
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2027-03-01')).toBe('2027-02-28');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29'); // 2028 is a leap year
  });

  it('longDate turns 2026-11-05 into Thursday 5 November', () => {
    expect(longDate('2026-11-05')).toBe('Thursday 5 November');
    expect(longDate('2028-02-29')).toBe('Tuesday 29 February');
  });
  it('daysAgo counts whole days from the server today, across a month end', () => {
    expect(daysAgo('2026-11-05', '2026-11-05')).toBe('Today');
    expect(daysAgo('2026-11-04', '2026-11-05')).toBe('Yesterday');
    expect(daysAgo('2026-11-01', '2026-11-05')).toBe('4 days ago');
    expect(daysAgo('2026-10-30', '2026-11-02')).toBe('3 days ago');
  });
});
