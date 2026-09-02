import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toCsv } from '@/lib/csv';
import { CAT_BY_ID } from '@/lib/categories';
import { isMonthKey, monthBounds } from '@/lib/month';

// GET /api/export/csv[?month=YYYY-MM] — spreadsheet-friendly export.
// Without a month it exports everything, matching the JSON export's scope.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = new URL(req.url).searchParams.get('month');
  const where: any = { userId: session.user.id };
  if (month && isMonthKey(month)) {
    const { start, end } = monthBounds(month);
    where.date = { gte: start, lt: end };
  }

  const rows = await prisma.entry.findMany({ where, orderBy: [{ date: 'asc' }] });

  const csv = toCsv([
    ['Date', 'Type', 'Category', 'Category Label', 'Note', 'Amount', 'Signed Amount'],
    ...rows.map((r) => {
      const amt = Number(r.amount);
      return [
        r.date.toISOString().slice(0, 10),
        r.type,
        r.category ?? '',
        r.category ? CAT_BY_ID[r.category]?.label ?? r.category : '',
        r.note,
        amt.toFixed(2),
        // Signed column so a pivot table can SUM straight down.
        (r.type === 'expense' ? -amt : amt).toFixed(2),
      ];
    }),
  ]);

  const suffix = month && isMonthKey(month) ? month : 'all';
  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      // BOM above + charset so Excel opens rupee symbols and names correctly.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="expense-tracker-${suffix}.csv"`,
    },
  });
}
