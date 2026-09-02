import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { entryInputSchema } from '@/lib/validation';
import { toDTO } from '@/lib/dto';
import { materializeRecurring } from '@/lib/recurring';
import { isMonthKey } from '@/lib/month';
import { etagJson } from '@/lib/http';

// GET /api/entries?month=YYYY-MM  → list current user's entries (optionally month-filtered)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get('month'); // "YYYY-MM"

  // Recurring rules become real rows here, before the month is read, so the
  // dashboard never renders a month that is missing its rent/bills.
  if (month && isMonthKey(month)) await materializeRecurring(session.user.id, month);

  const where: any = { userId: session.user.id };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    where.date = { gte: start, lt: end };
  }

  const rows = await prisma.entry.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  return etagJson(req, { entries: rows.map(toDTO) });
}

// POST /api/entries — create one entry
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = entryInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const e = parsed.data;
  const created = await prisma.entry.create({
    data: {
      userId: session.user.id,
      date: new Date(e.date + 'T00:00:00.000Z'),
      type: e.type,
      category: e.type === 'expense' ? e.category ?? null : null,
      amount: e.amount,
      note: e.note ?? '',
    },
  });
  return NextResponse.json({ entry: toDTO(created) }, { status: 201 });
}
