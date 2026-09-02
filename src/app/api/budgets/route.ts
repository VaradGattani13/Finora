import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { budgetSchema } from '@/lib/validation';
import { etagJson } from '@/lib/http';

// GET /api/budgets — this user's monthly caps
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.budget.findMany({ where: { userId: session.user.id } });
  return etagJson(req, {
    budgets: rows.map((b) => ({ category: b.category, amount: Number(b.amount) })),
  });
}

// PUT /api/budgets — set or clear one category's cap. amount 0 removes it.
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = budgetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { category, amount } = parsed.data;
  const userId = session.user.id;

  if (amount === 0) {
    await prisma.budget.deleteMany({ where: { userId, category } });
    return NextResponse.json({ category, amount: 0, removed: true });
  }

  const saved = await prisma.budget.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, amount },
    update: { amount },
  });
  return NextResponse.json({ category: saved.category, amount: Number(saved.amount) });
}
