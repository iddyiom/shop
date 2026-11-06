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

const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-11-05" → a Date at midnight UTC. UTC on purpose: no laptop time zone can shift the day. */
function utcDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "2026-11-05" → "2026-11-04". Month ends and leap years are handled by Date. */
export function dayBefore(date: string): string {
  const d = utcDay(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-05" → "Thursday 5 November". */
export function longDate(date: string): string {
  const d = utcDay(date);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]}`;
}

/** How long ago a day was, from the server's today: "Today", "Yesterday", "4 days ago". */
export function daysAgo(date: string, today: string): string {
  const days = Math.round((utcDay(today).getTime() - utcDay(date).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** +3 / −2: a stock change with its sign, so "added" and "removed" are clear at a glance. */
export function signed(change: number): string {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

/** Receipt lines → "2 Fanta, 1 Chocolate". */
export function itemsSummary(lines: ReceiptLine[]): string {
  return lines.map((line) => `${line.quantity} ${line.product}`).join(', ');
}

export const PAYMENT_LABEL: Record<'cash' | 'mobile_money', string> = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
};
