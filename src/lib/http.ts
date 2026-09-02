import crypto from 'crypto';

/**
 * JSON response with an ETag, so an unchanged month costs a 304 instead of a
 * full payload and a second Neon round trip.
 *
 * Cache-Control is `private, no-cache`, which is deliberate:
 *   private    — only the user's own browser may store it, never a CDN or proxy
 *   no-cache   — the browser MAY keep a copy but MUST revalidate before reuse
 *
 * That combination is what makes the ETag useful: the browser always asks, and
 * usually gets a 304 with no body. `no-store` would be stricter but would also
 * forbid the copy entirely, which is what makes an app feel slow on every
 * back-navigation.
 */
export function etagJson(req: Request, data: unknown, extraHeaders: Record<string, string> = {}) {
  const body = JSON.stringify(data);
  const etag = `W/"${crypto.createHash('sha1').update(body).digest('base64url')}"`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-cache',
    ETag: etag,
    // Caches must not serve one user's month to another with a different cookie.
    Vary: 'Cookie',
    ...extraHeaders,
  };

  // A matching validator means nothing changed — send no body at all.
  const inm = req.headers.get('if-none-match');
  if (inm && inm.split(',').some((t) => t.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { status: 200, headers });
}
