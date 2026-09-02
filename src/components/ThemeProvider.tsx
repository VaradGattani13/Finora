'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'system',   label: 'System default', hint: 'Follows your OS' },
  { id: 'light',    label: 'Light',          hint: 'Default paper' },
  { id: 'dark',     label: 'Dark',           hint: 'Neutral black' },
  { id: 'midnight', label: 'Midnight',       hint: 'Deep navy' },
  { id: 'sepia',    label: 'Sepia',          hint: 'Warm paper' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const STORAGE_KEY = 'etnx-theme';

/** Inlined in <head> before paint so the first frame is already themed. */
export const THEME_BOOTSTRAP = `(function(){try{
var t=localStorage.getItem('${STORAGE_KEY}')||'system';
var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;
document.documentElement.setAttribute('data-theme',r);
}catch(e){}})();`;

type Ctx = {
  theme: ThemeId;          // what the user picked (may be 'system')
  resolved: 'light' | 'dark' | 'midnight' | 'sepia'; // what is actually painted
  setTheme: (t: ThemeId) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const systemTheme = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('system');
  const [resolved, setResolved] = useState<Ctx['resolved']>('light');

  const apply = useCallback((t: ThemeId) => {
    const r = t === 'system' ? systemTheme() : t;
    document.documentElement.setAttribute('data-theme', r);
    setResolved(r);
  }, []);

  // Adopt whatever the bootstrap script already stamped.
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'system';
    const known = THEMES.some((t) => t.id === stored) ? stored : 'system';
    setThemeState(known);
    apply(known);
  }, [apply]);

  // Only 'system' tracks OS changes; an explicit pick stays put.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, apply]);

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      try { localStorage.setItem(STORAGE_KEY, t); } catch {}
      apply(t);
    },
    [apply]
  );

  return <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
