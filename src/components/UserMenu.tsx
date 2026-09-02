'use client';
import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useImport } from './ImportProvider';
import { THEMES, useTheme } from './ThemeProvider';
import { useCurrency } from './CurrencyProvider';
import { CURRENCIES } from '@/lib/currency';

/** "varad.gattani@gmail.com" → "VG"; "Varad Gattani" → "VG". */
export function initialsFor(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split('@')[0] || '?').replace(/[._-]+/g, ' ');
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

type Panel = 'import' | 'theme' | 'currency' | null;

export default function UserMenu({ name, email }: { name?: string | null; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openJson, openPdf } = useImport();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();

  // Click outside / Escape close the whole menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) { setOpen(false); setPanel(null); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setPanel(null); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Hover opens, but a short grace period keeps it alive while the pointer
  // crosses the gap between the avatar and the panel.
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => { setOpen(false); setPanel(null); }, 220);
  };
  useEffect(() => cancelClose, []);

  const run = (fn: () => void) => () => { fn(); setOpen(false); setPanel(null); };

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative' }}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email ?? 'current user'}`}
        onClick={() => { setOpen((o) => !o); setPanel(null); }}
      >
        {initialsFor(name, email)}
      </button>

      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">{email}</div>
          <div className="menu-sep" />

          {/* Import → submenu on hover */}
          <div style={{ position: 'relative' }} onMouseEnter={() => setPanel('import')}>
            <button
              className="menu-item"
              data-open={panel === 'import'}
              aria-haspopup="menu"
              aria-expanded={panel === 'import'}
              onClick={() => setPanel((p) => (p === 'import' ? null : 'import'))}
            >
              <span>Import</span>
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
            {panel === 'import' && (
              <div className="submenu" role="menu">
                <button className="menu-item" onClick={run(openJson)}>Via JSON file</button>
                <button className="menu-item" onClick={run(openPdf)}>Via bank statement PDF</button>
              </div>
            )}
          </div>

          {/* Theme → submenu on hover */}
          <div style={{ position: 'relative' }} onMouseEnter={() => setPanel('theme')}>
            <button
              className="menu-item"
              data-open={panel === 'theme'}
              aria-haspopup="menu"
              aria-expanded={panel === 'theme'}
              onClick={() => setPanel((p) => (p === 'theme' ? null : 'theme'))}
            >
              <span>Theme</span>
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
            {panel === 'theme' && (
              <div className="submenu" role="menu">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className="menu-item"
                    aria-checked={theme === t.id}
                    role="menuitemradio"
                    onClick={() => setTheme(t.id)}
                  >
                    <span>
                      {t.label}
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{t.hint}</span>
                    </span>
                    {theme === t.id && <span aria-hidden style={{ color: 'var(--accent)' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currency → submenu on hover. Display only: amounts are stored as
              plain numbers and are never converted between currencies. */}
          <div style={{ position: 'relative' }} onMouseEnter={() => setPanel('currency')}>
            <button
              className="menu-item"
              data-open={panel === 'currency'}
              aria-haspopup="menu"
              aria-expanded={panel === 'currency'}
              onClick={() => setPanel((p) => (p === 'currency' ? null : 'currency'))}
            >
              <span>Currency</span>
              <span aria-hidden style={{ color: 'var(--text-muted)', display: 'inline-flex', gap: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{currency.code}</span>›
              </span>
            </button>
            {panel === 'currency' && (
              <div className="submenu submenu-scroll" role="menu">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    className="menu-item"
                    aria-checked={currency.code === c.code}
                    role="menuitemradio"
                    onClick={() => setCurrency(c.code)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="cur-symbol">{c.symbol.trim()}</span>
                      <span>
                        {c.code}
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{c.label}</span>
                      </span>
                    </span>
                    {currency.code === c.code && <span aria-hidden style={{ color: 'var(--accent)' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="menu-sep" />
          <button className="menu-item danger" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
