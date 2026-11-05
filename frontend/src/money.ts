// Reading numbers typed by the owner. A quick check for a helpful message;
// the server checks again and has the final word.

export type Parsed = { ok: true; value: number } | { ok: false; error: string };

export const MAX_PRICE = 10_000_000; // same limit as the API (app/schemas.py)
export const MAX_LEVEL = 100_000;

/** "1,200" → 1200. Whole shillings only, 0 to 10,000,000. */
export function parseTsh(text: string): Parsed {
  const cleaned = text.replace(/,/g, '').trim(); // commas are fine while typing
  if (cleaned === '') return { ok: false, error: 'Enter a price in TSh.' };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'Use whole shillings, digits only (e.g. 1200).' };
  const value = Number(cleaned);
  if (value > MAX_PRICE) return { ok: false, error: 'That is more than TSh 10,000,000. Check the zeros.' };
  return { ok: true, value };
}

/** A low-stock level: a whole number, 0 to 100,000. */
export function parseLevel(text: string): Parsed {
  const cleaned = text.replace(/,/g, '').trim();
  if (cleaned === '') return { ok: false, error: 'Enter a low-stock level (0 if you do not want a warning).' };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'The low-stock level must be a whole number.' };
  const value = Number(cleaned);
  if (value > MAX_LEVEL) return { ok: false, error: 'That low-stock level is too big.' };
  return { ok: true, value };
}
