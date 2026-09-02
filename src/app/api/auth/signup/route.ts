import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { clientKey, rateLimit, tooMany } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  // Account creation is unauthenticated and writes to the database, so it is
  // the cheapest endpoint to abuse. 5 per IP per 10 minutes.
  const rl = rateLimit(clientKey(req, 'signup'), 5, 10 * 60_000);
  if (!rl.ok) return tooMany(rl, 'Too many sign-up attempts. Try again later.');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: parsed.data.name ?? null },
  });
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
