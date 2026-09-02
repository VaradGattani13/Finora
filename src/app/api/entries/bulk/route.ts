import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { bulkImportSchema } from '@/lib/validation';

// POST /api/entries/bulk — import many entries at once
// Body: { entries: EntryInput[], replace?: boolean }
// If replace=true, wipes the user's existing entries first (dangerous — used by "Clear + Import").
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = bulkImportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { entries, replace } = parsed.data;
  const userId = session.user.id;

  // `replace: true` deletes every entry the user owns. A stray or forged POST
  // should not be able to do that, so it needs an explicit second signal that
  // a curious caller would not send by accident.
  if (replace && body?.confirm !== 'REPLACE ALL MY ENTRIES') {
    return NextResponse.json(
      { error: 'replace:true requires confirm:"REPLACE ALL MY ENTRIES"' },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(async (tx: any) => {
    if (replace) await tx.entry.deleteMany({ where: { userId } });
    const rows = entries.map((e) => ({
      userId,
      date: new Date(e.date + 'T00:00:00.000Z'),
      type: e.type,
      category: e.type === 'expense' ? e.category ?? null : null,
      amount: e.amount,
      note: e.note ?? '',
    }));
    const res = await tx.entry.createMany({ data: rows });
    return res.count;
  });

  return NextResponse.json({ created });
}
