import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

export const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** No more than this many codes per email inside the TTL window. */
const MAX_SENDS_PER_WINDOW = 5;

export type Purpose = 'login' | 'signup';

const sixDigits = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Issues a fresh code, invalidating any outstanding one for the same
 * email+purpose so only the newest code ever works.
 * Returns null when the caller has hit the rate limit.
 */
export async function issueCode(email: string, purpose: Purpose): Promise<string | null> {
  const since = new Date(Date.now() - OTP_TTL_MINUTES * 60_000);
  const recent = await prisma.loginCode.count({
    where: { email, purpose, createdAt: { gte: since } },
  });
  if (recent >= MAX_SENDS_PER_WINDOW) return null;

  await prisma.loginCode.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = sixDigits();
  await prisma.loginCode.create({
    data: {
      email,
      purpose,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  });
  return code;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/** Consumes the code on success; burns an attempt on failure. */
export async function verifyCode(email: string, purpose: Purpose, code: string): Promise<VerifyResult> {
  const row = await prisma.loginCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return { ok: false, reason: 'No code pending. Request a new one.' };
  if (row.expiresAt < new Date()) return { ok: false, reason: 'Code expired. Request a new one.' };
  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.loginCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { ok: false, reason: 'Too many attempts. Request a new code.' };
  }

  if (!(await bcrypt.compare(code, row.codeHash))) {
    await prisma.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: 'Incorrect code.' };
  }

  await prisma.loginCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
