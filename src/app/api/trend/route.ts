import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { currentMonth, lastNMonths, monthBounds } from '@/lib/month';
import { etagJson } from '@/lib/http';

// GET /api/trend?months=12 — per-month totals for the trend chart.
// Aggregated server-side so the client never pulls a year of raw rows.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = Number(new URL(req.url).searchParams.get('months') ?? 12);
  const months = lastNMonths(Math.min(24, Math.max(3, Number.isFinite(raw) ? raw : 12)));

  const { start } = monthBounds(months[0]);
  const { end } = monthBounds(months[months.length - 1]);

  const rows = await prisma.entry.findMany({
    where: { userId: session.user.id, date: { gte: start, lt: end } },
    select: { date: true, type: true, amount: true },
  });

  const empty = () => ({ deposits: 0, spends: 0, net: 0, count: 0 });
  const byMonth = new Map(months.map((m) => [m, empty()]));

  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 7);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    const amt = Number(r.amount);
    if (r.type === 'deposit') bucket.deposits += amt;
    else bucket.spends += amt;
    bucket.count++;
  }
  for (const b of byMonth.values()) b.net = b.deposits - b.spends;

  return etagJson(req, {
    // The running month is partial — the chart dashes its last segment.
    currentMonth: currentMonth(),
    points: months.map((month) => ({ month, ...byMonth.get(month)! })),
  });
}
