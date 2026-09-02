import { NextResponse } from 'next/server';
import { z } from 'zod';
import { issueCode, OTP_TTL_MINUTES } from '@/lib/otp';
import { mailConfigured, otpEmail, sendMail } from '@/lib/mailer';
import { clientKey, rateLimit, tooMany } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().email() });

// POST /api/auth/otp — email a 6-digit sign-in code.
// The same code both verifies a new address and signs an existing user in, so
// the response never reveals whether the address is already registered.
export async function POST(req: Request) {
  // issueCode() already caps codes per EMAIL; this caps them per IP, so one
  // attacker cannot walk a list of addresses and send mail on our dime.
  const rl = rateLimit(clientKey(req, 'otp'), 10, 10 * 60_000);
  if (!rl.ok) return tooMany(rl, 'Too many code requests. Try again later.');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const code = await issueCode(email, 'login');
  if (!code) {
    return NextResponse.json(
      { error: 'Too many codes requested. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const { text, html } = otpEmail(code, OTP_TTL_MINUTES);
  try {
    await sendMail(email, 'Your Expense Tracker sign-in code', text, html);
  } catch {
    return NextResponse.json({ error: 'Could not send the email. Try again later.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES, delivered: mailConfigured });
}
