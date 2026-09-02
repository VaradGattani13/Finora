import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { entryInputSchema } from '@/lib/validation';
import { toDTO } from '@/lib/dto';

// PATCH /api/entries/:id — update an entry (only if owned by current user)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.entry.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = entryInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const e = parsed.data;
  const updated = await prisma.entry.update({
    where: { id },
    data: {
      date: new Date(e.date + 'T00:00:00.000Z'),
      type: e.type,
      category: e.type === 'expense' ? e.category ?? null : null,
      amount: e.amount,
      note: e.note ?? '',
    },
  });
  return NextResponse.json({ entry: toDTO(updated) });
}

// DELETE /api/entries/:id
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.entry.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.entry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
