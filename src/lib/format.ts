// Money + date helpers. Money is formatted in whatever display currency the
// user picked (see lib/currency.ts); amounts themselves are never converted.
import { getCurrency, type Currency } from './currency';

/** Full amount with symbol, e.g. "₹1,93,155.5" or "$12,480.25". */
export function fmtMoney(n: number | string, cur: Currency = getCurrency()): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return `${cur.symbol}0`;
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const s = abs.toLocaleString(cur.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}${cur.symbol}${s}`;
}

/**
 * Compact amount for chart axes. Indian currencies abbreviate on the
 * lakh/crore scale that readers there actually use; everything else uses
 * K/M/B, so a USD axis never reads "₹12.4L"-style nonsense.
 */
export function shortMoney(n: number, cur: Currency = getCurrency()): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  const out = (v: number, suffix: string) => `${sign}${cur.symbol}${v.toFixed(1)}${suffix}`;

  if (cur.indian) {
    if (a >= 1e7) return out(a / 1e7, 'Cr');
    if (a >= 1e5) return out(a / 1e5, 'L');
    if (a >= 1e3) return out(a / 1e3, 'k');
  } else {
    if (a >= 1e9) return out(a / 1e9, 'B');
    if (a >= 1e6) return out(a / 1e6, 'M');
    if (a >= 1e3) return out(a / 1e3, 'K');
  }
  return `${sign}${cur.symbol}${Math.round(a)}`;
}

/** Kept so the existing ~36 call sites need no edit. Currency-aware despite
 *  the rupee-era names; prefer fmtMoney/shortMoney in new code. */
export const fmtRupee = fmtMoney;
export const shortRupee = shortMoney;

export function isoDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
