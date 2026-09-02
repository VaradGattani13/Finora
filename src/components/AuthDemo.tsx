'use client';
import { useEffect, useRef, useState } from 'react';
import { fmtRupee } from '@/lib/format';

/**
 * The sign-in cover, as a running demo instead of a decorative bar chart.
 *
 * Three scenes, one per feature bullet, advancing on a timer. The bullets are
 * buttons, so the visitor can jump straight to the thing they care about —
 * that pairing is the point: the claim and its proof are the same control.
 *
 * Every animation is CSS-driven off a remount key, and the whole rotation stops
 * under prefers-reduced-motion, which leaves scene one rendered in its final state.
 */
const SCENES = [
  { id: 'budgets', label: 'Monthly caps per category, with an alert at 80%', dot: 'var(--pie-spends)' },
  { id: 'recurring', label: 'Rent and bills added automatically each month', dot: 'var(--pie-deposits)' },
  { id: 'trend', label: 'Twelve months of trend, and every export you need', dot: 'var(--trend-net)' },
] as const;

const DURATION = 5200;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Counts to `value` once per mount. Snaps straight to the value when reduced. */
function useCountUp(value: number, reduced: boolean) {
  const [n, setN] = useState(reduced ? value : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced) { setN(value); return; }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      // easeOutCubic — fast start, soft landing, no overshoot on money.
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced]);
  return n;
}

export default function AuthDemo() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const t = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), DURATION);
    return () => clearTimeout(t);
  }, [scene, reduced, paused]);

  return (
    <div
      className="demo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="demo-stage" key={scene}>
        {scene === 0 && <BudgetScene reduced={reduced} />}
        {scene === 1 && <RecurringScene />}
        {scene === 2 && <TrendScene reduced={reduced} />}
      </div>

      <ul className="demo-chapters">
        {SCENES.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`chapter ${i === scene ? 'is-active' : ''}`}
              aria-current={i === scene}
              onClick={() => setScene(i)}
            >
              <span className="legend-swatch" style={{ background: s.dot }} />
              <span className="chapter-text">{s.label}</span>
              <span className="chapter-rail">
                <span
                  className="chapter-fill"
                  key={`${scene}-${i}`}
                  style={{
                    animationDuration: `${DURATION}ms`,
                    animationPlayState: paused ? 'paused' : 'running',
                    width: i < scene ? '100%' : undefined,
                  }}
                  data-run={i === scene && !reduced ? 'yes' : 'no'}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- Scene 1: a budget filling past its warning line ---------------------- */
function BudgetScene({ reduced }: { reduced: boolean }) {
  const rows = [
    { label: 'Food', pct: 84, cap: 8000, spent: 6720, tone: 'bud-warn' },
    { label: 'Travel', pct: 46, cap: 4000, spent: 1840, tone: 'bud-ok' },
    { label: 'Grocery', pct: 61, cap: 6000, spent: 3660, tone: 'bud-ok' },
  ];
  return (
    <figure className="demo-card">
      <figcaption className="demo-cap">Budgets — September</figcaption>
      {rows.map((r, i) => (
        <div className="demo-budget" key={r.label} style={{ animationDelay: `${i * 110}ms` }}>
          <span className="demo-budget-name">{r.label}</span>
          <span className="bar-track" style={{ height: 7 }}>
            <span
              className={`bar-fill ${r.tone} demo-grow`}
              style={{ ['--to' as any]: `${r.pct}%`, animationDelay: `${180 + i * 110}ms` }}
            />
          </span>
          <span className="demo-budget-num">{r.pct}%</span>
        </div>
      ))}
      <div className="demo-alert" style={{ animationDelay: reduced ? '0ms' : '1250ms' }}>
        <span aria-hidden>▲</span>
        <span>Food is at 84% of {fmtRupee(8000)} — nearing your cap</span>
      </div>
    </figure>
  );
}

/* --- Scene 2: a recurring rule writing itself into the month -------------- */
function RecurringScene() {
  const rows = [
    { day: '03', name: 'Broadband', amt: 200, tag: true },
    { day: '05', name: 'Rent', amt: 1000, tag: true },
    { day: '06', name: 'Monthly SIP', amt: 500, tag: true },
  ];
  return (
    <figure className="demo-card">
      <figcaption className="demo-cap">September — added for you</figcaption>
      {rows.map((r, i) => (
        <div className="demo-row demo-slide" key={r.name} style={{ animationDelay: `${240 + i * 320}ms` }}>
          <span className="demo-day">{r.day}</span>
          <span className="demo-row-name">
            {r.name}
            {r.tag && <span className="pill-recurring">recurring</span>}
          </span>
          <span className="demo-row-amt">−{fmtRupee(r.amt).replace('-', '')}</span>
        </div>
      ))}
      <p className="demo-foot" style={{ animationDelay: '1400ms' }}>
        Set the rule once. Delete an entry and it stays deleted.
      </p>
    </figure>
  );
}

/* --- Scene 3: a year of spending, and the net landing --------------------- */
function TrendScene({ reduced }: { reduced: boolean }) {
  const bars = [38, 54, 41, 72, 49, 86, 44, 63, 33, 78, 58, 69];
  const net = useCountUp(69483, reduced);
  return (
    <figure className="demo-card">
      <figcaption className="demo-cap">Net across 12 months</figcaption>
      <div className="demo-net">{fmtRupee(net)}</div>
      <div className="demo-bars">
        {bars.map((h, i) => (
          <span
            key={i}
            className="demo-bar"
            style={{ ['--to' as any]: `${h}%`, animationDelay: `${i * 55}ms`, background: i === bars.length - 1 ? 'var(--pie-deposits)' : 'var(--pie-spends)' }}
          />
        ))}
      </div>
      <p className="demo-foot" style={{ animationDelay: '900ms' }}>
        Export the whole thing as CSV, JSON or PDF whenever you want.
      </p>
    </figure>
  );
}
