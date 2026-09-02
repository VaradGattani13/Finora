'use client';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';

export default function CategoryCombobox({
  id, value, onChange, disabled,
}: {
  id?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value ? CAT_BY_ID[value]?.label ?? '' : '');
  }, [value]);

  const q = text.trim().toLowerCase();
  const matches = q ? CATEGORIES.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q)) : CATEGORIES;
  const swatchColor = value ? CAT_BY_ID[value]?.color : 'var(--text-muted)';

  return (
    <div style={{ position: 'relative', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: 3, background: swatchColor, pointerEvents: 'none' }} />
      <input
        id={id}
        ref={inputRef}
        disabled={disabled}
        value={text}
        placeholder="Type or click to pick…"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { setText(e.target.value); onChange(null); setOpen(true); setActive(-1); }}
        onBlur={() => {
          setTimeout(() => {
            const t = text.trim().toLowerCase();
            const match = CATEGORIES.find((c) => c.label.toLowerCase() === t || c.id === t);
            if (match) onChange(match.id);
            setOpen(false);
          }, 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(matches.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter' && open && matches.length) {
            e.preventDefault();
            const pick = matches[active >= 0 ? active : 0];
            onChange(pick.id); setText(pick.label); setOpen(false); inputRef.current?.blur();
          }
          else if (e.key === 'Escape') setOpen(false);
        }}
        style={{ width: '100%', paddingLeft: 26 }}
      />
      {open && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
          background: 'var(--menu-bg)', border: '1px solid var(--border)', borderRadius: 8,
          margin: 0, padding: '4px 0', listStyle: 'none', maxHeight: 260, overflowY: 'auto',
          boxShadow: 'var(--shadow)',
        }}>
          {matches.length === 0 && <li style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No matching category</li>}
          {matches.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); onChange(c.id); setText(c.label); setOpen(false); }}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--text-primary)',
                background: i === active ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: 'none' }} />
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
