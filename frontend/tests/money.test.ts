// Tests for src/money.ts. Spec: docs/specs/f08-items.md, section 7.
import { describe, expect, it } from 'vitest';

import { parseLevel, parseTsh } from '../src/money';

describe('parseTsh', () => {
  it('accepts "1200" and "1,200", refuses "abc", "-5", "10000001", ""', () => {
    expect(parseTsh('1200')).toEqual({ ok: true, value: 1200 });
    expect(parseTsh(' 1,200 ')).toEqual({ ok: true, value: 1200 });
    expect(parseTsh('0')).toEqual({ ok: true, value: 0 });
    expect(parseTsh('abc').ok).toBe(false);
    expect(parseTsh('-5').ok).toBe(false);
    expect(parseTsh('12.5').ok).toBe(false);
    expect(parseTsh('10000001').ok).toBe(false);
    expect(parseTsh('').ok).toBe(false);
  });
});

describe('parseLevel', () => {
  it('accepts whole numbers from 0, refuses the rest', () => {
    expect(parseLevel('5')).toEqual({ ok: true, value: 5 });
    expect(parseLevel('x').ok).toBe(false);
    expect(parseLevel('').ok).toBe(false);
  });
});
