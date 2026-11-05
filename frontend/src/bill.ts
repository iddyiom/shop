// The bill on the sale screen, as plain functions (no React), so the rules are easy to test.
// Spec: docs/specs/f05-sale.md. The bill holds only product ids and quantities: never prices.
import { parseQuantity } from './money';
import type { Product } from './types';

export type BillLine = {
  productId: number;
  quantity: string; // as typed, so a half-typed number is not lost
};

export type CheckedLine = {
  line: BillLine;
  product: Product | null; // null: no longer on sale (stopped since the bill was made)
  quantity: number | null; // null while the typed text is not a valid quantity
  lineTotal: number | null; // PREVIEW only: card price × quantity
  problem: string | null; // what to show in red on the line
};

/** Picking a product already on the bill adds 1 to its line (rule 4). */
export function addProduct(bill: BillLine[], productId: number): BillLine[] {
  const existing = bill.find((line) => line.productId === productId);
  if (!existing) return [...bill, { productId, quantity: '1' }];
  return stepQuantity(bill, productId, 1);
}

/** The − and + buttons. Going below 1 removes the line (rule 5). */
export function stepQuantity(bill: BillLine[], productId: number, delta: number): BillLine[] {
  return bill.flatMap((line) => {
    if (line.productId !== productId) return [line];
    const current = parseQuantity(line.quantity);
    const next = (current.ok ? current.value : 0) + delta;
    return next < 1 ? [] : [{ ...line, quantity: String(next) }];
  });
}

export function setQuantity(bill: BillLine[], productId: number, text: string): BillLine[] {
  return bill.map((line) => (line.productId === productId ? { ...line, quantity: text } : line));
}

export function removeLine(bill: BillLine[], productId: number): BillLine[] {
  return bill.filter((line) => line.productId !== productId);
}

/** Check one line against the stock on its card, with the server's own words (rule 3). */
export function checkLine(line: BillLine, product: Product | undefined): CheckedLine {
  if (!product || product.quantity_in_store === 0) {
    return { line, product: product ?? null, quantity: null, lineTotal: null, problem: 'Item not available' };
  }
  const parsed = parseQuantity(line.quantity);
  if (!parsed.ok) {
    const problem = parsed.error.charAt(0).toUpperCase() + parsed.error.slice(1);
    return { line, product, quantity: null, lineTotal: null, problem };
  }
  const problem =
    parsed.value > product.quantity_in_store ? `Item over: only ${product.quantity_in_store} in store` : null;
  return { line, product, quantity: parsed.value, lineTotal: parsed.value * product.effective_price, problem };
}

/** The preview bill total: the sum of the line totals that can be worked out. */
export function previewTotal(lines: CheckedLine[]): number {
  return lines.reduce((sum, checked) => sum + (checked.lineTotal ?? 0), 0);
}

// ---------- Keeping the bill for this tab (rule 10) ----------

const BILL_KEY = 'depot-bill';

export function loadBill(): BillLine[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(BILL_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    // Keep only well-formed lines: anything else in storage is ignored, never trusted.
    return saved.filter(
      (line): line is BillLine =>
        typeof line === 'object' && line !== null &&
        Number.isInteger((line as BillLine).productId) && typeof (line as BillLine).quantity === 'string',
    );
  } catch {
    return [];
  }
}

export function saveBill(bill: BillLine[]): void {
  try {
    if (bill.length === 0) sessionStorage.removeItem(BILL_KEY);
    else sessionStorage.setItem(BILL_KEY, JSON.stringify(bill));
  } catch {
    // Storage blocked: the bill just is not kept when leaving the page.
  }
}

export function clearBill(): void {
  saveBill([]);
}
