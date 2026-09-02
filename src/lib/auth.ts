import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { z } from 'zod';
import { verifyCode } from './otp';
import { authConfig } from './auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  purpose: z.enum(['login', 'signup']),
  name: z.string().optional(),
});

/** Google is optional — without credentials the button simply is not offered. */
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const providers: NextAuthConfig['providers'] = [
  Credentials({
    id: 'credentials',
    name: 'Email and password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      // Google/OTP-only accounts have no hash — they cannot sign in this way.
      if (!user?.passwordHash) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      return { id: user.id, email: user.email, name: user.name ?? undefined };
    },
  }),

  Credentials({
    id: 'email-otp',
    name: 'Email code',
    credentials: {
      email: { label: 'Email', type: 'email' },
      code: { label: 'Code', type: 'text' },
      purpose: { label: 'Purpose', type: 'text' },
    },
    async authorize(raw) {
      const parsed = otpSchema.safeParse(raw);
      if (!parsed.success) return null;
      const email = parsed.data.email.toLowerCase();

      const result = await verifyCode(email, parsed.data.purpose, parsed.data.code);
      if (!result.ok) return null;

      // A verified code both proves ownership and, for signup, creates the account.
      const user = await prisma.user.upsert({
        where: { email },
        update: { emailVerified: new Date() },
        create: { email, name: parsed.data.name || null, emailVerified: new Date() },
      });
      return { id: user.id, email: user.email, name: user.name ?? undefined };
    },
  }),
];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Without this Google silently reuses whichever session is already
      // active, so a user with several accounts cannot pick one.
      authorization: { params: { prompt: 'select_account' } },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // Google users are provisioned here rather than via an adapter, so the JWT
    // strategy keeps working and we avoid the Account/Session tables.
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = user.email?.toLowerCase();
      if (!email) return '/login?error=GoogleNoEmail';

      // Google must positively assert the address is verified. Without this,
      // an unverified Google account could claim someone else's address.
      if ((profile as any)?.email_verified !== true) return '/login?error=GoogleUnverified';

      const existing = await prisma.user.findUnique({ where: { email } });

      // Collision: a password account already owns this address. Refuse rather
      // than silently linking — silent linking is an account-takeover path, and
      // it would drop the new signer straight into the existing user's data.
      if (existing?.passwordHash) return '/login?error=AccountExists';

      const row = existing
        ? await prisma.user.update({
            where: { email },
            data: {
              emailVerified: new Date(),
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
          })
        : await prisma.user.create({
            data: {
              email,
              name: user.name ?? null,
              image: user.image ?? null,
              emailVerified: new Date(),
            },
          });

      user.id = row.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      // Google's `user.id` is the provider id on first pass; make sure the
      // token always carries our own row id.
      if (!token.uid && token.email) {
        const row = await prisma.user.findUnique({ where: { email: String(token.email).toLowerCase() } });
        if (row) token.uid = row.id;
      }
      return token;
    },
    // `session` comes from authConfig — kept in one place so the edge and node
    // configs cannot drift apart.
  },
});

// Augment session.user with id
declare module 'next-auth' {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null };
  }
}
