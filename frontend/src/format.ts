// Turning API values into text for the screen. Formatting only: never calculating totals.
import type { ReceiptLine } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 184500 → "184,500" (whole TSh). */
export function formatTsh(amount: number): string {
  return amount.toLocaleString('en-US');
}

/**
 * "2026-11-05T14:32:00" → "14:32".
 * The API already sends depot time, so we read the text. Going through new Date() would
 * convert it to the laptop's time zone, and a laptop set to UTC would show 11:32.
 */
export function timeOf(dateTime: string): string {
  return dateTime.slice(11, 16);
}

/** "2026-11-01" → "1 Nov". Read as text too, for the same reason. */
export function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** Receipt lines → "2 Fanta, 1 Chocolate". */
export function itemsSummary(lines: ReceiptLine[]): string {
  return lines.map((line) => `${line.quantity} ${line.product}`).join(', ');
}

export const PAYMENT_LABEL: Record<'cash' | 'mobile_money', string> = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
};
