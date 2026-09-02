import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton.
 *
 * CONNECTION BUDGET: each running instance opens its own pool, and Prisma's
 * default size is (cpus * 2 + 1). On a serverless host every warm lambda is
 * another instance, so the default multiplies fast. Pin it explicitly and
 * point DATABASE_URL at Neon's `-pooler` host, which fronts Postgres with
 * PgBouncer and absorbs the fan-out.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Adds pooling params to the URL unless they are already spelled out. */
function tunedUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    // PgBouncer in transaction mode cannot use prepared statements.
    if (u.hostname.includes('-pooler') && !u.searchParams.has('pgbouncer')) {
      u.searchParams.set('pgbouncer', 'true');
    }
    // Serverless: each warm lambda holds its own pool, so keep this small (5).
    // One long-lived Node server: raise it — measured against Neon, 100
    // concurrent requests needed ~40 to keep p95 under ~5s.
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT ?? '10');
    }
    // Fail fast instead of piling up requests when the pool is saturated.
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '10');
    // Neon suspends idle computes; the first query after that pays a cold start.
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '15');
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: tunedUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
