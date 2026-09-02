'use client';
import { useMemo } from 'react';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';
import { fmtRupee, monthLabel } from '@/lib/format';
import type { EntryDTO } from '@/types/entry';

/** Which direction is an improvement, for colouring the delta. */
export type Polarity = 'up-good' | 'down-good' | 'neutral';

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null → "no baseline"
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Small "+₹1,240 (+18%) vs prev" line shown under a tile value. */
export function DeltaLine({
  current, previous, polarity = 'down-good', money = true,
}: {
  current: number;
  previous: number;
  polarity?: Polarity;
  money?: boolean;
}) {
  const diff = current - previous;
  const pct = pctChange(current, previous);
  const rising = diff > 0.005;
  const falling = diff < -0.005;

  let tone: 'up' | 'down' | 'flat' = 'flat';
  if (polarity !== 'neutral' && (rising || falling)) {
    const good = polarity === 'up-good' ? rising : falling;
    tone = good ? 'down' : 'up'; // .down is green, .up is red
  }

  const arrow = rising ? '▲' : falling ? '▼' : '■';
  const abs = Math.abs(diff);
  const amount = money ? fmtRupee(abs).replace('-', '') : String(Math.round(abs));
  const sign = rising ? '+' : falling ? '−' : '';

  return (
    <div className={`delta ${tone}`}>
      <span aria-hidden style={{ fontSize: 9 }}>{arrow}</span>
      <span>
        {sign}{amount}
        {pct !== null && Math.abs(pct) >= 0.5 && ` (${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%)`}
        {pct === null && ' (new)'}
      </span>
    </div>
  );
}

/**
 * Categories logged as expenses but which are really money moved, not money
 * consumed — so spending LESS on them is the bad trend, not the good one.
 * Investment is the only one: putting ₹1.2L away this month after ₹2L last
 * month is a decline and must read red, the opposite of every other category.
 */
const GROWTH_CATEGORIES = new Set(['invest']);

type Totals = { dep: number; spend: number; net: number; count: number; byCat: Record<string, number> };

function tally(entries: EntryDTO[], cutoffDay: number): Totals {
  const t: Totals = { dep: 0, spend: 0, net: 0, count: 0, byCat: {} };
  for (const e of entries) {
    if (parseInt(e.date.slice(8, 10), 10) > cutoffDay) continue;
    t.count++;
    if (e.type === 'deposit') t.dep += e.amount;
    else {
      t.spend += e.amount;
      if (e.category) t.byCat[e.category] = (t.byCat[e.category] || 0) + e.amount;
    }
  }
  t.net = t.dep - t.spend;
  return t;
}

export default function MonthComparison({
  month, prevMonth, cutoffDay, entries, prevEntries, partial, loading,
}: {
  month: string;
  prevMonth: string;
  cutoffDay: number;
  entries: EntryDTO[];
  prevEntries: EntryDTO[];
  /** True when the viewed month is still running, so both sides are clipped to cutoffDay. */
  partial: boolean;
  loading: boolean;
}) {
  const cur = useMemo(() => tally(entries, cutoffDay), [entries, cutoffDay]);
  const prev = useMemo(() => tally(prevEntries, cutoffDay), [prevEntries, cutoffDay]);

  const rows = useMemo(() => {
    const ids = new Set([...Object.keys(cur.byCat), ...Object.keys(prev.byCat)]);
    return CATEGORIES.filter((c) => ids.has(c.id))
      .map((c) => ({ cat: c, now: cur.byCat[c.id] || 0, before: prev.byCat[c.id] || 0 }))
      .sort((a, b) => b.now - a.now || b.before - a.before);
  }, [cur, prev]);

  const peak = Math.max(1, ...rows.flatMap((r) => [r.now, r.before]));

  const headline: { key: string; label: string; now: number; before: number; polarity: Polarity; money: boolean }[] = [
    { key: 'dep', label: 'Deposits', now: cur.dep, before: prev.dep, polarity: 'up-good', money: true },
    { key: 'spend', label: 'Spends', now: cur.spend, before: prev.spend, polarity: 'down-good', money: true },
    { key: 'net', label: 'Net', now: cur.net, before: prev.net, polarity: 'up-good', money: true },
    { key: 'count', label: 'Entries', now: cur.count, before: prev.count, polarity: 'neutral', money: false },
  ];

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          vs {monthLabel(prevMonth)}
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {partial
            ? `Both months counted to day ${cutoffDay} — like-for-like`
            : `Full ${monthLabel(month)} vs full ${monthLabel(prevMonth)}`}
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Loading comparison…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: rows.length ? 18 : 0 }}>
            {headline.map((h) => (
              <div key={h.key}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h.label}</div>
                <div style={{ fontSize: 19, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
                  {h.money ? fmtRupee(h.now) : h.now}
                </div>
                <DeltaLine current={h.now} previous={h.before} polarity={h.polarity} money={h.money} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  was {h.money ? fmtRupee(h.before) : h.before}
                </div>
              </div>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="table-wrap">
            <table style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>{monthLabel(month).split(' ')[0]}</th>
                  <th style={{ textAlign: 'right' }}>{monthLabel(prevMonth).split(' ')[0]}</th>
                  <th style={{ width: '30%' }}>Share</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ cat, now, before }) => (
                  <tr key={cat.id}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color, flex: 'none' }} />
                        {cat.label}
                      </span>
                    </td>
                    <td className="amt">{fmtRupee(now)}</td>
                    <td className="amt" style={{ color: 'var(--text-muted)' }}>{fmtRupee(before)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(now / peak) * 100}%`, background: cat.color }} /></div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(before / peak) * 100}%`, background: 'var(--axis)' }} /></div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex' }}>
                        <DeltaLine
                          current={now}
                          previous={before}
                          polarity={GROWTH_CATEGORIES.has(cat.id) ? 'up-good' : 'down-good'}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { tally };
export type { Totals };
