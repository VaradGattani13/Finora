'use client';
import { useEffect, useState } from 'react';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';
import { fmtRupee } from '@/lib/format';
import type { RecurringDTO } from '@/types/entry';
import { useCurrency } from './CurrencyProvider';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const ordinal = (d: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = d % 100;
  return d + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** One tap fills the form with the rule almost everyone needs first. */
const PRESETS = [
  { label: 'Rent', category: 'rent', amount: '12000', day: '5', note: 'Rent' },
  { label: 'Broadband', category: 'bills', amount: '800', day: '5', note: 'Broadband' },
  { label: 'Monthly SIP', category: 'invest', amount: '2000', day: '6', note: 'SIP' },
];

export default function RecurringPanel({ onChanged }: { onChanged: () => void }) {
  const { currency: cur } = useCurrency();
  const [rules, setRules] = useState<RecurringDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<'expense' | 'deposit'>('expense');
  const [category, setCategory] = useState('rent');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState('5');
  const [startMonth, setStartMonth] = useState(thisMonth());

  useEffect(() => { void load(true); }, []);

  async function load(firstRun = false) {
    setLoading(true);
    try {
      const res = await fetch('/api/recurring');
      if (res.ok) {
        const list = (await res.json()).rules as RecurringDTO[];
        setRules(list);
        // With nothing set up yet the form is the whole point of the panel, so
        // it starts open rather than hiding behind a button nobody finds.
        if (firstRun && list.length === 0) setOpen(true);
      }
    } finally { setLoading(false); }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setType('expense');
    setCategory(p.category);
    setAmount(p.amount);
    setDay(p.day);
    setNote(p.note);
    setOpen(true);
    setMsg(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    const d = parseInt(day, 10);
    if (!amt || amt <= 0) { setMsg({ text: 'Enter an amount greater than 0.', kind: 'error' }); return; }
    if (!d || d < 1 || d > 31) { setMsg({ text: 'Day must be between 1 and 31.', kind: 'error' }); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, category: type === 'expense' ? category : null,
          amount: amt, note, dayOfMonth: d, startMonth,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        setMsg({ text: `Could not save that rule (${res.status}). ${detail.slice(0, 120)}`, kind: 'error' });
        return;
      }
      const { generated } = await res.json();
      setMsg({
        text: generated > 0
          ? `Saved — ${generated} entr${generated === 1 ? 'y' : 'ies'} added from ${startMonth} onward.`
          : 'Rule saved. Its first entry appears when that month arrives.',
        kind: 'success',
      });
      setAmount(''); setNote(''); setOpen(false);
      await load();
      onChanged();
    } finally { setSaving(false); }
  }

  async function patch(id: string, body: any) {
    await fetch(`/api/recurring/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
    await load();
    onChanged();
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="chart-head">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Recurring entries{rules.length > 0 && <span className="count-pill">{rules.length}</span>}
        </h2>
        <button className="btn-secondary" onClick={() => { setOpen((v) => !v); setMsg(null); }}>
          {open ? 'Cancel' : '+ Add a recurring entry'}
        </button>
      </div>

      <p className="muted-note">
        Rent, bills and SIPs repeat every month. A rule creates its entry automatically when you
        open that month, and backfills from the start month you choose — edit or delete a generated
        entry and it will not come back.
      </p>

      {!open && (
        <div className="preset-row">
          <span className="preset-hint">Start from:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="preset-chip" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <form className="form-grid recurring-form" onSubmit={create}>
          <div className="field">
            <label htmlFor="r-type">Type</label>
            <select id="r-type" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="expense">Expense</option>
              <option value="deposit">Deposit</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-cat">Category</label>
            <select id="r-cat" value={category} disabled={type === 'deposit'}
              onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-amt">Amount ({cur.symbol.trim()})</label>
            <input id="r-amt" type="number" min="1" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="12000" />
          </div>
          <div className="field">
            <label htmlFor="r-day">Day of month</label>
            <input id="r-day" type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="r-start">Starts</label>
            <input id="r-start" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="r-note">Note</label>
            <input id="r-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rent" />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save rule'}
            </button>
          </div>
        </form>
      )}

      {msg && (
        <div
          className="form-note"
          role="status"
          style={{ color: msg.kind === 'success' ? 'var(--good)' : 'var(--danger)' }}
        >
          {msg.text}
        </div>
      )}

      {loading && <div className="muted-note">Loading rules…</div>}

      {!loading && rules.length === 0 && !open && (
        <div className="chart-empty">No recurring entries yet — pick one above to get started.</div>
      )}

      {rules.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>What</th><th>When</th><th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const cat = r.category ? CAT_BY_ID[r.category] : null;
                return (
                  <tr key={r.id} style={r.active ? undefined : { opacity: 0.55 }}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        {cat && <span className="legend-swatch" style={{ background: cat.color }} />}
                        {r.note || cat?.label || (r.type === 'deposit' ? 'Deposit' : 'Expense')}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{ordinal(r.dayOfMonth)} of each month</td>
                    <td className="amt">{fmtRupee(r.amount)}</td>
                    <td>
                      <span className={`tag ${r.active ? 'dep' : ''}`}>{r.active ? 'Active' : 'Paused'}</span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary" style={{ marginRight: 4 }}
                        onClick={() => patch(r.id, { active: !r.active })}>
                        {r.active ? 'Pause' : 'Resume'}
                      </button>
                      <button className="btn-secondary" style={{ color: 'var(--danger)' }}
                        onClick={() => remove(r.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
