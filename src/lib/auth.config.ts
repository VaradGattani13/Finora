import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe half of the auth config.
 *
 * Middleware runs in the Edge runtime, which has no Node built-ins — so it must
 * never reach Prisma, bcrypt or `crypto`. This file therefore holds only what
 * is needed to *read* an existing JWT: no providers, no database, no `jwt`
 * callback. The full config in `auth.ts` layers those on for the Node runtime.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
