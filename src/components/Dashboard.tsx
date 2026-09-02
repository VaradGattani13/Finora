'use client';
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';
import { fmtRupee, monthLabel } from '@/lib/format';
import type { EntryDTO, EntryInput, TrendPoint } from '@/types/entry';
import PieChart from './PieChart';
import BarChart from './BarChart';
import TrendChart from './TrendChart';
import BudgetPanel from './BudgetPanel';
import RecurringPanel from './RecurringPanel';
import EntriesTable from './EntriesTable';
import CategoryCombobox from './CategoryCombobox';
import MonthComparison, { DeltaLine, tally } from './MonthComparison';
import { useImport } from './ImportProvider';
import { buildSampleEntries } from '@/lib/sample-data';
import { useCurrency } from './CurrencyProvider';

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => todayISO().slice(0, 7);

/** "2026-08" → "2026-07" */
function prevMonthOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const daysInMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export default function Dashboard() {
  const { currency: cur } = useCurrency();
  const [month, setMonth] = useState(currentMonth());
  const [focusDate, setFocusDate] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<EntryDTO[]>([]);
  const [prevEntries, setPrevEntries] = useState<EntryDTO[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [cmpLoading, setCmpLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sampleMode, setSampleMode] = useState(false);
  const { version } = useImport();

  // form state
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<'expense' | 'deposit'>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMsg, setFormMsg] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);

  const prevMonth = useMemo(() => prevMonthOf(month), [month]);
  const isCurrentMonth = month === currentMonth();
  // Month-to-date: clip both months to the same day so the comparison is fair.
  const cutoffDay = isCurrentMonth ? new Date().getDate() : daysInMonth(month);

  useEffect(() => { void loadMonth(month); }, [month, version]);
  useEffect(() => { void loadPrev(prevMonth); }, [prevMonth, version]);
  useEffect(() => { void loadTrend(); }, [version, month]);

  async function loadMonth(m: string) {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/entries?month=${m}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(data.entries as EntryDTO[]);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function loadPrev(m: string) {
    setCmpLoading(true);
    try {
      const res = await fetch(`/api/entries?month=${m}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPrevEntries(data.entries as EntryDTO[]);
    } catch { setPrevEntries([]); }
    finally { setCmpLoading(false); }
  }

  async function loadTrend() {
    try {
      const res = await fetch('/api/trend?months=12');
      if (res.ok) setTrend((await res.json()).points as TrendPoint[]);
    } catch { setTrend([]); }
  }

  // --- Sample preview -------------------------------------------------------
  // Demo rows live only in memory; nothing is written to the database, so the
  // toggle is free to turn on and off.
  const sampleAll = useMemo(() => (sampleMode ? buildSampleEntries(6) : []), [sampleMode]);
  const srcEntries = sampleMode ? sampleAll.filter((e) => e.date.startsWith(month)) : entries;
  const srcPrev = sampleMode ? sampleAll.filter((e) => e.date.startsWith(prevMonth)) : prevEntries;

  const srcTrend: TrendPoint[] = useMemo(() => {
    if (!sampleMode) return trend;
    const months = [...new Set(sampleAll.map((e) => e.date.slice(0, 7)))].sort();
    return months.map((m) => {
      const rows = sampleAll.filter((e) => e.date.startsWith(m));
      const deposits = rows.filter((r) => r.type === 'deposit').reduce((s, r) => s + r.amount, 0);
      const spends = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
      return { month: m, deposits, spends, net: deposits - spends, count: rows.length };
    });
  }, [sampleMode, sampleAll, trend]);

  // A brand-new account: no entries anywhere in the last year.
  const isNewUser = !loading && !sampleMode && entries.length === 0 &&
    trend.length > 0 && trend.every((p) => p.count === 0);

  const matchesSearch = (e: EntryDTO) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const num = parseFloat(q);
    if (!isNaN(num) && String(num) === q && Math.abs(e.amount - num) < 0.005) return true;
    const catLabel = e.type === 'expense' && e.category ? CAT_BY_ID[e.category]?.label ?? '' : e.type === 'deposit' ? 'deposit' : '';
    return `${e.note} ${catLabel} ${e.type} ${e.date}`.toLowerCase().includes(q);
  };

  const dateScope = useMemo(
    () => (focusDate ? srcEntries.filter((e) => e.date === focusDate) : srcEntries),
    [srcEntries, focusDate]
  );
  const scope = useMemo(() => dateScope.filter(matchesSearch), [dateScope, query]);

  const totals = useMemo(() => {
    let dep = 0, spend = 0;
    for (const e of scope) { if (e.type === 'deposit') dep += e.amount; else spend += e.amount; }
    return { dep, spend, net: dep - spend, count: scope.length };
  }, [scope]);

  // Tile deltas only make sense against an unfiltered month-to-date baseline,
  // so they are hidden while a search or date focus narrows the view.
  const filtered = Boolean(query.trim() || focusDate);
  const mtd = useMemo(() => tally(srcEntries, cutoffDay), [srcEntries, cutoffDay]);
  const prevMtd = useMemo(() => tally(srcPrev, cutoffDay), [srcPrev, cutoffDay]);

  /** Whole-month spend per category — the baseline budgets are measured against. */
  const spendByCategory = useMemo(() => {
    const t: Record<string, number> = {};
    for (const e of srcEntries) if (e.type === 'expense' && e.category) t[e.category] = (t[e.category] || 0) + e.amount;
    return t;
  }, [srcEntries]);

  const pie1 = [
    { label: 'Spends', value: totals.spend, color: 'var(--pie-spends)' },
    { label: 'Deposits', value: totals.dep, color: 'var(--pie-deposits)' },
  ];

  const pie2 = useMemo(() => {
    const t: Record<string, number> = {};
    for (const e of scope) if (e.type === 'expense' && e.category) t[e.category] = (t[e.category] || 0) + e.amount;
    return CATEGORIES.map((c) => ({ label: c.label, value: t[c.id] || 0, color: c.color })).filter((d) => d.value > 0);
  }, [scope]);

  const barPoints = useMemo(
    () =>
      srcEntries
        .filter(matchesSearch)
        .filter((e) => e.type === 'expense')
        .map((e) => ({ day: parseInt(e.date.slice(8, 10), 10), value: e.amount, dateStr: e.date })),
    [srcEntries, query]
  );

  function resetForm() {
    setDate(isCurrentMonth ? todayISO() : month + '-01');
    setType('expense'); setCategory(null); setAmount(''); setNote(''); setEditingId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sampleMode) { setFormMsg({ text: 'Exit sample data to add real entries.', kind: 'error' }); return; }
    const amt = parseFloat(amount);
    if (!date) { setFormMsg({ text: 'Pick a date.', kind: 'error' }); return; }
    if (!amt || amt <= 0 || isNaN(amt)) { setFormMsg({ text: 'Enter amount > 0.', kind: 'error' }); return; }
    if (type === 'expense' && !category) { setFormMsg({ text: 'Pick a category.', kind: 'error' }); return; }

    const payload: EntryInput = { date, type, category: type === 'expense' ? category : null, amount: amt, note };
    const url = editingId ? `/api/entries/${editingId}` : '/api/entries';
    const res = await fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { setFormMsg({ text: 'Save failed.', kind: 'error' }); return; }
    setFormMsg({ text: editingId ? 'Entry updated.' : 'Entry added.', kind: 'success' });
    resetForm();
    await Promise.all([loadMonth(month), loadTrend()]);
  }

  async function del(id: string) {
    if (sampleMode) return;
    const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    if (res.ok) { if (editingId === id) resetForm(); await Promise.all([loadMonth(month), loadTrend()]); }
  }

  function edit(e: EntryDTO) {
    if (sampleMode) return;
    setEditingId(e.id); setDate(e.date); setType(e.type);
    setCategory(e.type === 'expense' ? e.category : null);
    setAmount(String(e.amount)); setNote(e.note);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!formMsg) return;
    const t = setTimeout(() => setFormMsg(null), 3000);
    return () => clearTimeout(t);
  }, [formMsg]);

  const sorted = useMemo(() => scope.slice().sort((a, b) => b.date.localeCompare(a.date)), [scope]);

  return (
    <>
      {sampleMode && (
        <div className="sample-banner" role="status">
          <span><strong>Sample data.</strong> Nothing here is saved — your own entries are untouched.</span>
          <button className="btn-secondary" onClick={() => setSampleMode(false)}>Exit sample data</button>
        </div>
      )}

      {isNewUser && (
        <div className="panel onboard" style={{ marginBottom: 16 }}>
          <h2 className="onboard-title">Welcome — let’s get your first month in.</h2>
          <p className="muted-note">
            Add an entry below and the charts fill in immediately. Three things make this stick:
            set a monthly budget, mark your rent as recurring, and import a statement instead of typing.
          </p>
          <div className="onboard-actions">
            <button className="btn" onClick={() => document.getElementById('e-amt')?.focus()}>
              Add my first entry
            </button>
            <button className="btn-secondary" onClick={() => setSampleMode(true)}>
              Explore with sample data
            </button>
          </div>
        </div>
      )}

      {/* Month / search bar */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="f-month">Viewing month</label>
            <input id="f-month" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setFocusDate(''); }} />
          </div>
          <div className="field">
            <label htmlFor="f-focus">Focus a date</label>
            <input id="f-focus" type="date" value={focusDate} onChange={(e) => setFocusDate(e.target.value)} min={month + '-01'} />
          </div>
          <div className="field">
            <label htmlFor="f-q">Search notes / category / amount</label>
            <input id="f-q" type="search" placeholder="e.g. IPO, auto, zomato, 12000" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="toolbar">
          <a className="btn-secondary" href="/api/export/csv" download>Export CSV (all)</a>
          <a className="btn-secondary" href={`/api/export/csv?month=${month}`} download>Export CSV ({month})</a>
          <a className="btn-secondary" href="/api/export/json" download>Export JSON</a>
          <a className="btn-secondary" href={`/api/export/pdf?month=${month}&currency=${cur.code}`} download>Export PDF ({month})</a>
          {focusDate && <button className="btn-secondary" onClick={() => setFocusDate('')}>Clear date focus</button>}
          {query && <button className="btn-secondary" onClick={() => setQuery('')}>Clear search</button>}
          {!sampleMode && !isNewUser && (
            <button className="btn-secondary" onClick={() => setSampleMode(true)}>View sample data</button>
          )}
        </div>
      </div>

      {/* Entry form */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 className="section-title">{editingId ? 'Update entry' : 'Add entry'}</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="e-date">Date</label>
              <input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-type">Type</label>
              <select id="e-type" value={type} onChange={(e) => { setType(e.target.value as any); if (e.target.value === 'deposit') setCategory(null); }}>
                <option value="expense">Expense</option>
                <option value="deposit">Deposit</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="e-cat">Category</label>
              <CategoryCombobox id="e-cat" value={category} onChange={setCategory} disabled={type === 'deposit'} />
            </div>
            <div className="field">
              <label htmlFor="e-amt">Amount ({cur.symbol.trim()})</label>
              <input id="e-amt" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field">
              <label htmlFor="e-note">Note (optional)</label>
              <input id="e-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Zomato dinner" />
            </div>
            {/* Last grid cell: on a wide row it sits flush after Note, otherwise it
                spans the full width of whatever the row has wrapped into. */}
            <div className="form-actions">
              <button type="submit" className="btn">{editingId ? 'Update' : 'Add'}</button>
              {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
            </div>
          </div>
          {formMsg && (
            <div className="form-note" style={{ color: formMsg.kind === 'success' ? 'var(--good)' : 'var(--danger)' }}>{formMsg.text}</div>
          )}
        </form>
      </div>

      {/* Tiles */}
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="card pos">
          <div className="k">Total deposits</div>
          <div className="v">{fmtRupee(totals.dep)}</div>
          {!filtered && <DeltaLine current={mtd.dep} previous={prevMtd.dep} polarity="up-good" />}
        </div>
        <div className="card neg">
          <div className="k">Total spends</div>
          <div className="v">{fmtRupee(totals.spend)}</div>
          {!filtered && <DeltaLine current={mtd.spend} previous={prevMtd.spend} polarity="down-good" />}
        </div>
        <div className={`card ${totals.net > 0 ? 'pos' : totals.net < 0 ? 'neg' : ''}`}>
          <div className="k">Net</div>
          <div className="v">{fmtRupee(totals.net)}</div>
          {!filtered && <DeltaLine current={mtd.net} previous={prevMtd.net} polarity="up-good" />}
        </div>
        <div className="card">
          <div className="k">Entries</div>
          <div className="v">{query ? `${totals.count} / ${dateScope.length}` : totals.count}</div>
          {!filtered && <DeltaLine current={mtd.count} previous={prevMtd.count} polarity="neutral" money={false} />}
        </div>
      </div>

      {/* Budgets */}
      <BudgetPanel spendByCategory={spendByCategory} monthLabel={monthLabel(month)} />

      {/* Recurring rules */}
      {!sampleMode && <RecurringPanel onChanged={() => { void loadMonth(month); void loadTrend(); }} />}

      {/* Trend across months */}
      <div style={{ marginBottom: 16 }}>
        <TrendChart points={srcTrend} currentMonth={currentMonth()} />
      </div>

      {/* Month-on-month comparison */}
      <MonthComparison
        month={month}
        prevMonth={prevMonth}
        cutoffDay={cutoffDay}
        entries={srcEntries}
        prevEntries={srcPrev}
        partial={isCurrentMonth}
        loading={sampleMode ? false : cmpLoading || loading}
      />

      {/* Pies */}
      <div className="charts" style={{ marginBottom: 16 }}>
        <PieChart title="Spends vs Deposits" data={pie1} />
        <PieChart title="Distribution of Spends" data={pie2} />
      </div>

      {/* Bar */}
      <div style={{ marginBottom: 16 }}>
        <BarChart month={month} points={barPoints} title={`Daily Spends (${cur.symbol.trim()})`} />
      </div>

      {/* Entries table */}
      {loading && !sampleMode ? (
        <div className="panel"><div className="muted-note">Loading…</div></div>
      ) : err ? (
        <div className="panel"><div style={{ color: 'var(--danger)' }}>{err}</div></div>
      ) : (
        <EntriesTable
          entries={sorted}
          title={`Entries — ${monthLabel(month)}`}
          readOnly={sampleMode}
          onEdit={edit}
          onDelete={del}
        />
      )}
    </>
  );
}
