import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CAT_BY_ID } from '@/lib/categories';
import { fmtMoney } from '@/lib/format';
import { currencyByCode, DEFAULT_CURRENCY } from '@/lib/currency';

export const runtime = 'nodejs';

// GET /api/export/pdf?month=YYYY-MM  → downloadable PDF report of the month
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  // The display currency lives in the browser's localStorage, so the client
  // passes it on the link; anything unrecognised falls back to the default.
  const cur = currencyByCode(url.searchParams.get('currency') ?? DEFAULT_CURRENCY);
  if (!month || !/^\d{4}-\d{2}$/.test(month))
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 });

  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const rows = await prisma.entry.findMany({
    where: { userId: session.user.id, date: { gte: start, lt: end } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Dynamic imports so jspdf doesn't touch the build unless used
  const { jsPDF } = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const monthLabel = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Header
  doc.setFontSize(16);
  doc.text(`Expense Tracker — ${monthLabel}`, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `${session.user.email ?? ''} · generated ${new Date().toISOString().slice(0, 10)}`,
    40,
    56
  );
  doc.setTextColor(0);

  // Totals
  let dep = 0, spend = 0;
  const catTotals: Record<string, number> = {};
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.type === 'deposit') dep += amt;
    else {
      spend += amt;
      if (r.category) catTotals[r.category] = (catTotals[r.category] || 0) + amt;
    }
  }

  autoTable(doc, {
    startY: 80,
    head: [['Total Deposits', 'Total Spends', 'Net', 'Entries']],
    body: [[fmtMoney(dep, cur), fmtMoney(spend, cur), fmtMoney(dep - spend, cur), String(rows.length)]],
    styles: { fontSize: 10, halign: 'center' },
    headStyles: { fillColor: [45, 45, 45] },
    theme: 'grid',
  });

  // Category breakdown
  const catRows = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, total]) => [CAT_BY_ID[id]?.label ?? id, fmtMoney(total, cur), `${((total / spend) * 100).toFixed(1)}%`]);
  if (catRows.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Category', 'Total', '% of Spends']],
      body: catRows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [45, 45, 45] },
      theme: 'striped',
    });
  }

  // All entries table
  const entryRows = rows.map((r: any) => [
    r.date.toISOString().slice(0, 10),
    r.type,
    r.type === 'expense' && r.category ? CAT_BY_ID[r.category]?.label ?? r.category : '—',
    r.note,
    (r.type === 'expense' ? '-' : '+') + fmtMoney(Number(r.amount), cur).replace('-', ''),
  ]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Date', 'Type', 'Category', 'Note', 'Amount']],
    body: entryRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [45, 45, 45] },
    columnStyles: { 4: { halign: 'right' } },
    theme: 'striped',
  });

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `expense-tracker-${month}.pdf`;
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
