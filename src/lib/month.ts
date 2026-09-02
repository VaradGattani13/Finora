/** Helpers for "YYYY-MM" month keys. All arithmetic is UTC so a machine's
 *  timezone can never shift an entry into the wrong month. */

export const isMonthKey = (m: string) => /^\d{4}-\d{2}$/.test(m);

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export function monthAdd(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Inclusive range of month keys, oldest first. Empty if `to` precedes `from`. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  // Guard against a malformed range spinning forever.
  for (let i = 0; i < 600 && cur <= to; i++) {
    out.push(cur);
    cur = monthAdd(cur, 1);
  }
  return out;
}

/** UTC [start, end) bounds for a month, for Prisma date filters. */
export function monthBounds(ym: string): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** The last N months ending at `end` (inclusive), oldest first. */
export const lastNMonths = (n: number, end = currentMonth()) =>
  monthRange(monthAdd(end, -(n - 1)), end);
