import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Built from the edge-safe config only — importing '@/lib/auth' here would pull
// Prisma, bcrypt and crypto into the Edge runtime.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Protect the app; leave the public marketing surface, auth pages, PWA
    // files and static assets open. The trailing `.+` (not `.*`) is what keeps
    // "/" itself out of the matcher, so the landing page is reachable signed-out.
    '/((?!login|signup|offline|api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).+)',
  ],
};
