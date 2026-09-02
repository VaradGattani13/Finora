/**
 * Display currency. Stored per-browser next to the theme, because it is a
 * presentation choice: amounts are kept in the database as plain decimals and
 * are never converted — switching currency re-labels the numbers, it does not
 * apply an exchange rate.
 */
export type Currency = {
  code: string;
  symbol: string;
  label: string;
  /** Locale used for digit grouping. */
  locale: string;
  /** Indian grouping (lakh/crore) rather than thousands/millions. */
  indian?: boolean;
};

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹',    label: 'Indian Rupee',       locale: 'en-IN', indian: true },
  { code: 'USD', symbol: '$',    label: 'US Dollar',          locale: 'en-US' },
  { code: 'EUR', symbol: '€',    label: 'Euro',               locale: 'de-DE' },
  { code: 'JPY', symbol: '¥',    label: 'Japanese Yen',       locale: 'ja-JP' },
  { code: 'GBP', symbol: '£',    label: 'British Pound',      locale: 'en-GB' },
  { code: 'KRW', symbol: '₩',    label: 'South Korean Won',   locale: 'ko-KR' },
  { code: 'AED', symbol: 'د.إ',  label: 'UAE Dirham',         locale: 'en-AE' },
  { code: 'AUD', symbol: 'A$',   label: 'Australian Dollar',  locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$',   label: 'Canadian Dollar',    locale: 'en-CA' },
  { code: 'CHF', symbol: 'CHF ', label: 'Swiss Franc',        locale: 'de-CH' },
];

export const DEFAULT_CURRENCY = 'INR';
export const CURRENCY_KEY = 'etnx-currency';

export const currencyByCode = (code: string): Currency =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

/**
 * Module-level active currency.
 *
 * The formatters in lib/format.ts are plain functions called from ~36 places,
 * including inside chart render loops. Threading a React hook through all of
 * them would be a large refactor for a setting that changes once in a blue
 * moon, so the provider writes the choice here and remounts the app subtree —
 * see CurrencyProvider.
 */
let active: Currency = CURRENCIES[0];

export const getCurrency = (): Currency => active;

export function setActiveCurrency(code: string): Currency {
  active = currencyByCode(code);
  return active;
}

/** Runs in <head> before paint so the first frame is already labelled right. */
export const CURRENCY_BOOTSTRAP = `(function(){try{
var c=localStorage.getItem('${CURRENCY_KEY}')||'${DEFAULT_CURRENCY}';
document.documentElement.setAttribute('data-currency',c);
}catch(e){}})();`;
