'use client';
import { useMemo } from 'react';
import { CURRENCIES } from '@/lib/currency';

/**
 * Ambient currency symbols that pop in and out behind the auth cover.
 *
 * Positions and timings are derived from a fixed hash rather than Math.random,
 * so the server and client render identical markup — a random layout here would
 * hydrate mismatched. Purely decorative: aria-hidden, pointer-events none, and
 * it disappears entirely under prefers-reduced-motion.
 */

/** Cheap deterministic 0..1 from an integer seed. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const COUNT = 18;

export default function CurrencyGlyphs() {
  const glyphs = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const cur = CURRENCIES[i % CURRENCIES.length];
        return {
          key: `${cur.code}-${i}`,
          symbol: cur.symbol.trim(),
          // Kept off the vertical centre band so the glyphs frame the copy
          // rather than sitting behind it.
          left: 4 + rand(i * 3 + 1) * 88,
          top: 3 + rand(i * 5 + 2) * 92,
          size: 15 + Math.round(rand(i * 7 + 3) * 30),
          delay: (rand(i * 11 + 4) * 9).toFixed(2),
          duration: (5.5 + rand(i * 13 + 5) * 5).toFixed(2),
          drift: (rand(i * 17 + 6) * 16 - 8).toFixed(1),
        };
      }),
    []
  );

  return (
    <div className="glyph-field" aria-hidden>
      {glyphs.map((g) => (
        <span
          key={g.key}
          className="glyph"
          style={{
            left: `${g.left}%`,
            top: `${g.top}%`,
            fontSize: `${g.size}px`,
            animationDelay: `${g.delay}s`,
            animationDuration: `${g.duration}s`,
            ['--drift' as any]: `${g.drift}px`,
          }}
        >
          {g.symbol}
        </span>
      ))}
    </div>
  );
}
