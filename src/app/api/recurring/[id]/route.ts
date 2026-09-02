import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** Shared ownership check — mirrors the entries routes: another user's id is a
 *  404, never a 403, so ids can't be probed for existence. */
async function owned(id: string, userId: string) {
  const rule = await prisma.recurringRule.findUnique({ where: { id } });
  return rule && rule.userId === userId ? rule : null;
}

// PATCH /api/recurring/:id — pause/resume or edit amount.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await owned(id, session.user.id)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.active === 'boolean') data.active = body.active;
  if (typeof body.amount === 'number' && body.amount > 0) data.amount = body.amount;
  if (typeof body.note === 'string') data.note = body.note;
  if (typeof body.endMonth === 'string' || body.endMonth === null) data.endMonth = body.endMonth;
  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const updated = await prisma.recurringRule.update({ where: { id }, data });
  return NextResponse.json({ ok: true, active: updated.active });
}

// DELETE /api/recurring/:id — removes the rule. Entries it already created are
// kept (they are real spending); the FK is set to null by the schema.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await owned(id, session.user.id)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.recurringRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
