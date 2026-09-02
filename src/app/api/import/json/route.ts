import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { entryInputSchema } from '@/lib/validation';
import { isValidCategoryId } from '@/lib/categories';

const MAX_IMPORT_ROWS = 5000;

// POST /api/import/json — accept a JSON payload (either shape works: legacy v1 or new v2)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const entries: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
  if (entries.length === 0)
    return NextResponse.json({ error: 'No entries found in payload' }, { status: 400 });
  // Unbounded before: a single request could insert millions of rows. The cap
  // matches /api/entries/bulk so the two import paths behave the same.
  if (entries.length > MAX_IMPORT_ROWS)
    return NextResponse.json(
      { error: `Too many entries in one import. Limit is ${MAX_IMPORT_ROWS}.` },
      { status: 413 }
    );

  const clean = entries
    .map((e) => ({
      date: e.date,
      type: e.type,
      category: e.type === 'expense' ? (isValidCategoryId(e.category) ? e.category : null) : null,
      amount: typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount,
      note: typeof e.note === 'string' ? e.note : '',
    }))
    .filter((e) => {
      const p = entryInputSchema.safeParse(e);
      return p.success;
    });

  if (clean.length === 0) return NextResponse.json({ error: 'No valid entries' }, { status: 400 });

  const userId = session.user.id;
  const rows = clean.map((e) => ({
    userId,
    date: new Date(e.date + 'T00:00:00.000Z'),
    type: e.type as 'expense' | 'deposit',
    category: e.category,
    amount: e.amount,
    note: e.note,
  }));
  const res = await prisma.entry.createMany({ data: rows });
  return NextResponse.json({ created: res.count, skipped: entries.length - clean.length });
}
