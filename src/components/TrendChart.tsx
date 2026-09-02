'use client';
import { useMemo, useState } from 'react';
import { shortRupee, fmtRupee } from '@/lib/format';
import type { TrendPoint } from '@/types/entry';

type Series = { key: 'spends' | 'deposits' | 'net'; label: string; color: string };

// Fixed order, never cycled — colour follows the measure, not its rank, so
// hiding a series never repaints the others.
const SERIES: Series[] = [
  { key: 'spends', label: 'Spends', color: 'var(--pie-spends)' },
  { key: 'deposits', label: 'Deposits', color: 'var(--pie-deposits)' },
  { key: 'net', label: 'Net', color: 'var(--trend-net)' },
];

const shortMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
};

export default function TrendChart({
  points,
  currentMonth,
  title = 'Trend — last 12 months',
}: {
  points: TrendPoint[];
  currentMonth: string;
  title?: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const visible = SERIES.filter((s) => !hidden.has(s.key));
  const hasData = points.some((p) => p.deposits !== 0 || p.spends !== 0);

  const W = 900, H = 280;
  const padL = 56, padR = 76, padT = 16, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const { min, max } = useMemo(() => {
    const vals: number[] = [];
    for (const p of points) for (const s of visible) vals.push(p[s.key]);
    if (!vals.length) return { min: 0, max: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    return { min: niceFloor(lo), max: niceCeil(hi) || 1 };
  }, [points, visible.map((s) => s.key).join()]);

  if (!hasData) {
    return (
      <div className="panel">
        <h2 className="section-title">{title}</h2>
        <div className="chart-empty">
          Not enough history yet — the trend appears once you have entries in more than one month.
        </div>
      </div>
    );
  }

  const n = Math.max(points.length - 1, 1);
  const xFor = (i: number) => padL + (i / n) * plotW;
  const yFor = (v: number) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;

  // The running month is incomplete, so its final segment is dashed rather than
  // being read as a real drop.
  const partialIdx = points.findIndex((p) => p.month === currentMonth);
  const pathFor = (s: Series, from: number, to: number) =>
    points
      .slice(from, to)
      .map((p, k) => `${k === 0 ? 'M' : 'L'} ${xFor(from + k)} ${yFor(p[s.key])}`)
      .join(' ');

  const solidEnd = partialIdx === -1 ? points.length : partialIdx + 1;
  const zeroY = yFor(0);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="panel">
      <div className="chart-head">
        <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
        <div className="legend">
          {SERIES.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                className="legend-item"
                aria-pressed={!off}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    // Never let the user hide the last visible series.
                    if (next.has(s.key)) next.delete(s.key);
                    else if (prev.size < SERIES.length - 1) next.add(s.key);
                    return next;
                  })
                }
                style={{ opacity: off ? 0.4 : 1 }}
              >
                <span className="legend-swatch" style={{ background: s.color }} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="chart-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}. ${visible.map((s) => s.label).join(', ')} by month.`}
          style={{ display: 'block', width: '100%', minWidth: 520 }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((x - padL) / plotW) * n);
            setHover(i >= 0 && i < points.length ? i : null);
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = min + (max - min) * f;
            return (
              <g key={f}>
                <line x1={padL} x2={padL + plotW} y1={yFor(v)} y2={yFor(v)} stroke="var(--grid)" strokeWidth={1} />
                <text x={padL - 8} y={yFor(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
                  {shortRupee(v)}
                </text>
              </g>
            );
          })}
          {min < 0 && <line x1={padL} x2={padL + plotW} y1={zeroY} y2={zeroY} stroke="var(--axis)" strokeWidth={1} />}

          {points.map((p, i) =>
            i % (points.length > 8 ? 2 : 1) === 0 ? (
              <text key={p.month} x={xFor(i)} y={H - 12} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {shortMonth(p.month)}
              </text>
            ) : null
          )}

          {hover !== null && (
            <line x1={xFor(hover)} x2={xFor(hover)} y1={padT} y2={padT + plotH} stroke="var(--axis)" strokeWidth={1} strokeDasharray="3 3" />
          )}

          {visible.map((s) => (
            <g key={s.key}>
              <path d={pathFor(s, 0, solidEnd)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {solidEnd < points.length && (
                <path d={pathFor(s, solidEnd - 1, points.length)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
              )}
              {/* Direct label at the line end — identity without relying on colour,
                  which is what the light-mode contrast relief requires. */}
              <text x={xFor(points.length - 1) + 8} y={yFor(points[points.length - 1][s.key]) + 4} fontSize={11} fill="var(--text-secondary)">
                {s.label}
              </text>
              {hover !== null && (
                <circle cx={xFor(hover)} cy={yFor(points[hover][s.key])} r={4.5} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
              )}
            </g>
          ))}
        </svg>
      </div>

      {active && (
        <div className="chart-readout">
          <strong>{active.month}</strong>
          {visible.map((s) => (
            <span key={s.key} className="readout-item">
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.label} {fmtRupee(active[s.key])}
            </span>
          ))}
          <span className="readout-item" style={{ color: 'var(--text-muted)' }}>{active.count} entries</span>
        </div>
      )}
    </div>
  );
}

function niceCeil(v: number) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}
function niceFloor(v: number) {
  if (v >= 0) return 0;
  const a = Math.abs(v);
  const p = Math.pow(10, Math.floor(Math.log10(a)));
  return -Math.ceil(a / p) * p;
}
