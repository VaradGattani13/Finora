'use client';
import { fmtRupee } from '@/lib/format';

export type PieSlice = { label: string; value: number; color: string };

export default function PieChart({ data, title }: { data: PieSlice[]; title?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return (
      <div className="panel">
        {title && <h2 className="section-title">{title}</h2>}
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: 12 }}>
          No data yet — add an entry to see this chart.
        </div>
      </div>
    );
  }

  const S = 240, cx = S / 2, cy = S / 2, r = 100, rInner = 52;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d) => {
    const frac = d.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const arc = { ...d, frac, a0, a1 };
    a0 = a1;
    return arc;
  });

  const arcPath = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) {
      return `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} M ${cx + rInner} ${cy} A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy} A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy} Z`;
    }
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0o = cx + r * Math.cos(a0), y0o = cy + r * Math.sin(a0);
    const x1o = cx + r * Math.cos(a1), y1o = cy + r * Math.sin(a1);
    const x1i = cx + rInner * Math.cos(a1), y1i = cy + rInner * Math.sin(a1);
    const x0i = cx + rInner * Math.cos(a0), y0i = cy + rInner * Math.sin(a0);
    return `M ${x0o} ${y0o} A ${r} ${r} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i} Z`;
  };

  const legendItems = arcs.slice().sort((a, b) => b.value - a.value);

  return (
    <div className="panel">
      {title && <h2 className="section-title">{title}</h2>}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 240px', maxWidth: 240 }}>
          <svg viewBox={`0 0 ${S} ${S}`} style={{ display: 'block', width: '100%' }}>
            {arcs.map((a, i) => (
              <path key={i} d={arcPath(a.a0, a.a1)} fill={a.color} stroke="var(--surface-1)" strokeWidth={2}>
                <title>{a.label}: {fmtRupee(a.value)} ({(a.frac * 100).toFixed(1)}%)</title>
              </path>
            ))}
            <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize={11} style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</text>
            <text x={cx} y={cy + 18} textAnchor="middle" fill="var(--text-primary)" fontSize={18} fontWeight={600} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtRupee(total)}</text>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {legendItems.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, marginTop: 3, background: a.color, flex: 'none' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{a.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtRupee(a.value)} · {(a.frac * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

