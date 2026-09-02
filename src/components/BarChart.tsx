'use client';
import { shortRupee, fmtRupee } from '@/lib/format';

type Point = { day: number; value: number; dateStr: string };

export default function BarChart({ month, points, title }: { month: string; points: Point[]; title?: string }) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const daily = new Array(days + 1).fill(0);
  for (const p of points) if (p.day >= 1 && p.day <= days) daily[p.day] += p.value;

  const total = daily.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return (
      <div className="panel">
        {title && <h2 className="section-title">{title}</h2>}
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: 12 }}>
          No spends yet — add an expense to see the daily bar chart.
        </div>
      </div>
    );
  }

  const W = 900, H = 240;
  const padL = 44, padR = 12, padT = 16, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let max = 0;
  for (let i = 1; i <= days; i++) if (daily[i] > max) max = daily[i];
  const niceMax = niceCeil(max);
  const barW = (plotW / days) * 0.72;
  const step = plotW / days;
  const yFor = (v: number) => padT + plotH - (v / niceMax) * plotH;
  const labelEvery = days > 20 ? 2 : 1;
  const monthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });

  return (
    <div className="panel">
      {title && <h2 className="section-title">{title}</h2>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', overflow: 'visible' }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (niceMax * i) / 4;
          const yy = yFor(v);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="var(--grid)" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fill="var(--text-muted)" fontSize={10}>
                {shortRupee(v)}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--axis)" />
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const v = daily[d];
          const x = padL + (d - 0.5) * step - barW / 2;
          const yTop = yFor(v);
          const h = padT + plotH - yTop;
          return (
            <g key={d}>
              {v > 0 && (
                <rect x={x} y={yTop} width={barW} height={h} rx={2} ry={2} fill="var(--pie-spends)">
                  <title>{`Day ${d}: ${fmtRupee(v)}`}</title>
                </rect>
              )}
              {(d === 1 || d === days || d % labelEvery === 0) && (
                <text x={padL + (d - 0.5) * step} y={padT + plotH + 14} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
                  {d}
                </text>
              )}
            </g>
          );
        })}
        <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
          {monthName} {y}
        </text>
      </svg>
    </div>
  );
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  let m;
  if (n <= 1) m = 1;
  else if (n <= 2) m = 2;
  else if (n <= 2.5) m = 2.5;
  else if (n <= 5) m = 5;
  else m = 10;
  return m * pow;
}

