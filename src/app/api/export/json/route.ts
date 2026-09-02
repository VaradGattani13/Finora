import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toDTO } from '@/lib/dto';

// GET /api/export/json — download all entries as JSON
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.entry.findMany({
    where: { userId: session.user.id },
    orderBy: [{ date: 'asc' }],
  });
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    userEmail: session.user.email,
    entries: rows.map(toDTO),
  };
  const filename = `expense-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
