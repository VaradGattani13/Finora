import type { EntryDTO } from '@/types/entry';
import { monthAdd, currentMonth, daysInMonth } from './month';

/**
 * Demo entries for the first-run preview. Held in memory only — the sample
 * toggle never writes to the database, so there is nothing to clean up and no
 * risk of demo rows being mistaken for real spending.
 */
const SHAPE: [string, 'expense' | 'deposit', string | null, number, string][] = [
  ['salary', 'deposit', null, 82000, 'Salary'],
  ['rent', 'expense', 'rent', 18000, 'Rent'],
  ['sip', 'expense', 'invest', 10000, 'Monthly SIP'],
  ['bills', 'expense', 'bills', 1450, 'Electricity'],
  ['bills2', 'expense', 'bills', 799, 'Broadband'],
  ['grocery', 'expense', 'grocery', 3200, 'Big Basket'],
  ['grocery2', 'expense', 'grocery', 860, 'Zepto'],
  ['food', 'expense', 'food', 540, 'Swiggy'],
  ['food2', 'expense', 'food', 260, 'Coffee'],
  ['food3', 'expense', 'food', 1100, 'Dinner out'],
  ['travel', 'expense', 'travel', 90, 'Auto'],
  ['travel2', 'expense', 'travel', 35, 'Metro'],
  ['travel3', 'expense', 'travel', 1800, 'Weekend trip'],
  ['shopping', 'expense', 'shopping', 2400, 'Shoes'],
  ['misc', 'expense', 'misc', 600, 'Movie'],
];

/** Deterministic jitter so the demo looks organic but never changes between renders. */
const wobble = (seed: number) => 0.75 + ((Math.sin(seed * 12.9898) + 1) / 2) * 0.5;

export function buildSampleEntries(months = 6): EntryDTO[] {
  const out: EntryDTO[] = [];
  let n = 0;
  for (let back = months - 1; back >= 0; back--) {
    const ym = monthAdd(currentMonth(), -back);
    const dim = daysInMonth(ym);
    SHAPE.forEach(([key, type, category, base, note], i) => {
      const reps = type === 'deposit' ? 1 : key.startsWith('food') || key.startsWith('travel') ? 3 : 1;
      for (let r = 0; r < reps; r++) {
        n++;
        const day = Math.min(dim, 1 + ((i * 3 + r * 7 + back) % (dim - 1)));
        const amount = type === 'deposit' ? base : Math.round(base * wobble(n));
        out.push({
          id: `sample-${n}`,
          date: `${ym}-${String(day).padStart(2, '0')}`,
          type,
          category,
          amount,
          note,
        });
      }
    });
  }
  return out;
}
