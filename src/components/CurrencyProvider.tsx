'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CURRENCIES, CURRENCY_KEY, DEFAULT_CURRENCY, currencyByCode, setActiveCurrency, type Currency,
} from '@/lib/currency';

type Ctx = { currency: Currency; setCurrency: (code: string) => void };
const CurrencyCtx = createContext<Ctx | null>(null);

export default function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState(DEFAULT_CURRENCY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored = DEFAULT_CURRENCY;
    try { stored = localStorage.getItem(CURRENCY_KEY) ?? DEFAULT_CURRENCY; } catch {}
    const known = CURRENCIES.some((c) => c.code === stored) ? stored : DEFAULT_CURRENCY;
    setActiveCurrency(known);
    setCode(known);
    setReady(true);
  }, []);

  const setCurrency = useCallback((next: string) => {
    setActiveCurrency(next);
    try { localStorage.setItem(CURRENCY_KEY, next); } catch {}
    document.documentElement.setAttribute('data-currency', next);
    setCode(next);
  }, []);

  // The formatters read a module-level value rather than a hook, so a currency
  // change is published by remounting the subtree: `key` forces every consumer
  // to re-render with the new symbol, including charts that format inside
  // their own render loops. It happens rarely enough that the cost is invisible.
  return (
    <CurrencyCtx.Provider value={{ currency: currencyByCode(code), setCurrency }}>
      <div key={ready ? code : 'boot'} style={{ display: 'contents' }}>{children}</div>
    </CurrencyCtx.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) throw new Error('useCurrency must be used inside <CurrencyProvider>');
  return ctx;
}
