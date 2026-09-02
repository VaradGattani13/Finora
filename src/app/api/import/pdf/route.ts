import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseBankStatement, guessCategory } from '@/lib/pdf-bank-parser';
import { clientKey, rateLimit, tooMany } from '@/lib/rate-limit';

// POST /api/import/pdf — accepts multipart form with `file` field
// Returns parsed rows (does NOT save yet — user reviews and confirms first).
export const runtime = 'nodejs';

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
/** Statements are rarely long; a 5,000-page PDF is an attack, not a bank. */
const MAX_PDF_PAGES = 100;
/** Bound the response too — the client renders every suggestion. */
const MAX_ROWS = 2000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // PDF parsing is CPU-heavy and holds the whole file in memory, so it is
  // rate limited even for signed-in users.
  const rl = rateLimit(clientKey(req, 'pdf'), 10, 5 * 60_000);
  if (!rl.ok) return tooMany(rl, 'Too many uploads. Wait a minute and try again.');

  // Reject an oversized upload from the header before reading the body, so a
  // 500 MB "PDF" never reaches arrayBuffer() and blows up the process.
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large. Limit is ${MAX_UPLOAD_MB} MB.` }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });

  // content-length can lie or be absent (chunked), so check the real size too.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large. Limit is ${MAX_UPLOAD_MB} MB.` }, { status: 413 });
  }
  if (file.type && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted.' }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // Content sniffing: a real PDF starts with %PDF-. Stops a renamed .exe or zip
  // bomb from reaching the parser at all.
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return NextResponse.json({ error: 'That file is not a PDF.' }, { status: 415 });
  }

  // Dynamically import so it doesn't break the build if the package is missing on some hosts
  const { default: pdfParse } = await import('pdf-parse');
  let parsed;
  try {
    // A malformed or malicious PDF must return 400, never crash the route.
    parsed = await pdfParse(buf, { max: MAX_PDF_PAGES });
  } catch {
    return NextResponse.json({ error: 'Could not read that PDF. It may be encrypted or corrupt.' }, { status: 400 });
  }
  const rows = parseBankStatement(parsed.text).slice(0, MAX_ROWS);

  // Attach a category guess so the user only tweaks the wrong ones
  const suggestions = rows
    .filter((r) => r.amount >= 10) // apply user's <₹10 skip rule by default
    .map((r) => ({
      ...r,
      category: r.type === 'deposit' ? null : guessCategory(r.narration, r.amount),
    }));

  return NextResponse.json({ suggestions, totalRows: rows.length, kept: suggestions.length });
}
