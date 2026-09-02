/**
 * Fixed-window rate limiter.
 *
 * SCOPE: in-memory, so it protects ONE server instance. That is the right fit
 * for a single-region beta; the moment this runs on more than one instance
 * (Vercel scaling out, multiple containers) an attacker gets N× the limit and
 * this must move to Redis/Upstash. The interface below is deliberately the
 * same shape a Redis version would have, so swapping it is a one-file change.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Drop expired buckets occasionally so the map cannot grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export type RateResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets — goes straight into Retry-After. */
  retryAfter: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  b.count++;
  const retryAfter = Math.ceil((b.resetAt - now) / 1000);
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfter };
}

/**
 * Best-effort client identity. Behind a proxy the socket address is the proxy,
 * so we prefer the forwarded headers Vercel/Cloudflare set. These are
 * spoofable when the app is exposed directly, which is another reason this is
 * a speed bump rather than a security boundary.
 */
export function clientKey(req: Request, scope: string): string {
  const h = req.headers;
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown';
  return `${scope}:${ip}`;
}

/** 429 with the headers clients actually look at. */
export function tooMany(r: RateResult, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(r.retryAfter),
      'X-RateLimit-Remaining': String(r.remaining),
    },
  });
}
