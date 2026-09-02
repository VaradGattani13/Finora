'use client';
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';
import { fmtRupee } from '@/lib/format';
import type { BudgetDTO } from '@/types/entry';
import { useCurrency } from './CurrencyProvider';

type Status = 'ok' | 'warn' | 'over';

/** Status is never colour-alone — each row carries an icon and a worded label. */
const STATUS_META: Record<Status, { icon: string; word: string; cls: string }> = {
  ok: { icon: '●', word: 'on track', cls: 'bud-ok' },
  warn: { icon: '▲', word: 'nearing cap', cls: 'bud-warn' },
  over: { icon: '■', word: 'over budget', cls: 'bud-over' },
};

const statusOf = (pct: number): Status => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');

export default function BudgetPanel({
  spendByCategory,
  monthLabel,
}: {
  spendByCategory: Record<string, number>;
  monthLabel: string;
}) {
  const { currency: cur } = useCurrency();
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newAmt, setNewAmt] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/budgets');
      if (res.ok) setBudgets((await res.json()).budgets);
    } finally { setLoading(false); }
  }

  async function save(category: string, amount: number) {
    const res = await fetch('/api/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount }),
    });
    if (res.ok) await load();
  }

  const rows = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = spendByCategory[b.category] ?? 0;
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        return { ...b, spent, pct, status: statusOf(pct), cat: CAT_BY_ID[b.category] };
      })
      .filter((r) => r.cat)
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, spendByCategory]);

  const alerts = rows.filter((r) => r.status !== 'ok');
  const unbudgeted = CATEGORIES.filter((c) => !budgets.some((b) => b.category === c.id));

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="chart-head">
        <h2 className="section-title" style={{ marginBottom: 0 }}>Budgets — {monthLabel}</h2>
        {unbudgeted.length > 0 && (
          <button className="btn-secondary" onClick={() => { setAdding((v) => !v); setNewCat(unbudgeted[0].id); }}>
            {adding ? 'Cancel' : '+ Set a budget'}
          </button>
        )}
      </div>

      {adding && (
        <form
          className="budget-add"
          onSubmit={async (e) => {
            e.preventDefault();
            const amt = parseFloat(newAmt);
            if (!newCat || !amt || amt <= 0) return;
            await save(newCat, amt);
            setAdding(false); setNewAmt('');
          }}
        >
          <div className="field">
            <label htmlFor="b-cat">Category</label>
            <select id="b-cat" value={newCat} onChange={(e) => setNewCat(e.target.value)}>
              {unbudgeted.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="b-amt">Monthly cap ({cur.symbol.trim()})</label>
            <input id="b-amt" type="number" min="1" step="1" value={newAmt}
              onChange={(e) => setNewAmt(e.target.value)} placeholder="12000" />
          </div>
          <button type="submit" className="btn">Save</button>
        </form>
      )}

      {alerts.length > 0 && (
        <div className={`budget-alert ${alerts.some((a) => a.status === 'over') ? 'is-over' : 'is-warn'}`} role="status">
          <strong>{alerts.some((a) => a.status === 'over') ? 'Over budget' : 'Nearing your cap'}</strong>
          <span>
            {alerts.map((a) => `${a.cat.label} ${Math.round(a.pct)}%`).join(' · ')}
          </span>
        </div>
      )}

      {loading && <div className="muted-note">Loading budgets…</div>}

      {!loading && rows.length === 0 && (
        <div className="chart-empty">
          No budgets yet. Set a monthly cap on a category and this panel tracks it —
          you get a warning at 80% and a flag when you go over.
        </div>
      )}

      {rows.map((r) => {
        const meta = STATUS_META[r.status];
        return (
          <div key={r.category} className="budget-row">
            <div className="budget-label">
              <span className="legend-swatch" style={{ background: r.cat.color }} />
              <span>{r.cat.label}</span>
            </div>

            <div className="budget-bar">
              <div className="bar-track" style={{ height: 8 }}>
                <div className={`bar-fill ${meta.cls}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
              </div>
              <div className={`budget-meta ${meta.cls}`}>
                <span aria-hidden>{meta.icon}</span>
                <span>{fmtRupee(r.spent)} of {fmtRupee(r.amount)} · {Math.round(r.pct)}% · {meta.word}</span>
              </div>
            </div>

            <div className="budget-actions">
              {editing === r.category ? (
                <>
                  <input
                    type="number" min="0" step="1" value={draft} autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                    style={{ width: 96 }}
                  />
                  <button className="btn-secondary" onClick={async () => {
                    const v = parseFloat(draft);
                    if (!isNaN(v) && v >= 0) await save(r.category, v);
                    setEditing(null);
                  }}>Save</button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => { setEditing(r.category); setDraft(String(r.amount)); }}>Edit</button>
                  <button className="btn-secondary" style={{ color: 'var(--danger)' }}
                    onClick={() => save(r.category, 0)}>Remove</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
