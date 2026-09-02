import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recurringSchema } from '@/lib/validation';
import { materializeRecurring } from '@/lib/recurring';
import { currentMonth } from '@/lib/month';

const toDTO = (r: any) => ({
  id: r.id,
  type: r.type,
  category: r.category,
  amount: Number(r.amount),
  note: r.note,
  dayOfMonth: r.dayOfMonth,
  startMonth: r.startMonth,
  endMonth: r.endMonth,
  active: r.active,
  lastRunMonth: r.lastRunMonth,
});

// GET /api/recurring — this user's rules
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.recurringRule.findMany({
    where: { userId: session.user.id },
    orderBy: [{ active: 'desc' }, { dayOfMonth: 'asc' }],
  });
  return NextResponse.json({ rules: rows.map(toDTO) });
}

// POST /api/recurring — create a rule, then immediately backfill it from its
// start month up to today so the user sees the effect straight away.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = recurringSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const r = parsed.data;
  const created = await prisma.recurringRule.create({
    data: {
      userId: session.user.id,
      type: r.type,
      category: r.type === 'expense' ? r.category ?? null : null,
      amount: r.amount,
      note: r.note ?? '',
      dayOfMonth: r.dayOfMonth,
      startMonth: r.startMonth,
      endMonth: r.endMonth ?? null,
      active: r.active,
    },
  });

  const generated = await materializeRecurring(session.user.id, currentMonth());
  return NextResponse.json({ rule: toDTO(created), generated }, { status: 201 });
}
