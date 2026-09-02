# Expense Tracker — Next.js + Postgres

Multi-user personal finance tracker. Rebuild of the single-file HTML tracker
with a real database (Postgres), authentication (NextAuth), bank-statement PDF
import, and PDF/JSON export.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma ORM** + **PostgreSQL** (Docker Compose for local, any hosted Postgres for prod)
- **NextAuth v5** — email + password (bcrypt), Google OAuth, and passwordless email OTP
- **nodemailer** for OTP delivery (falls back to console logging in dev)
- **jsPDF + pdf-parse** for PDF export / bank-statement PDF import
- Custom SVG charts (no chart library)
- Themeable UI — system / light / dark / midnight / sepia, persisted per browser

## Local setup

Prereqs: Node 18+, Docker Desktop (for Postgres), npm.

```bash
# 1. Install
npm install

# 2. Set up env
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET (openssl rand -base64 32)

# 3. Start Postgres (Docker)
npm run db:up

# 4. Run migrations
npm run db:migrate
# Accept the default migration name (e.g. "init") when prompted

# 5. Start dev server
npm run dev
```

Open http://localhost:3000. First visit: sign up with any email + password (min 6 chars).

## Configuration

Everything is driven by environment variables — no values are hardcoded in
`src/`. Copy `.env.example` to `.env` and fill in. **`.env` is gitignored;
`.env.example` is committed, so it must never contain real values.**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | Postgres connection string |
| `AUTH_SECRET` | **yes** | — | JWT signing key. `openssl rand -base64 32`, fresh per environment |
| `NEXTAUTH_URL` | **yes** | — | Public origin. Must match the port/host you actually serve on |
| `GOOGLE_CLIENT_ID` | no | blank | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | no | blank | Google OAuth client secret |
| `SMTP_HOST` | prod only | blank | SMTP server for OTP emails |
| `SMTP_PORT` | no | `587` | `465` switches to implicit TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | prod only | blank | SMTP credentials (Gmail: use an App Password) |
| `MAIL_FROM` | no | `SMTP_USER` | From address on OTP emails |

Optional, consumed only by `docker-compose.yml`: `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_CONTAINER`.

### Graceful degradation

Optional config is genuinely optional — the app boots and runs without it:

- **No Google credentials** → the "Continue with Google" button is hidden on
  both `/login` and `/signup`. It appears automatically once both values are
  set and the server is restarted (env is read at boot only).
- **No SMTP** → OTP codes print to the server console in development. In
  production this is refused outright, so codes can never be silently dropped.

### Enabling Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → *Web application*.
2. Under **Authorised redirect URIs** (not "JavaScript origins") add, exactly:
   `<NEXTAUTH_URL>/api/auth/callback/google` — e.g. `http://localhost:3000/api/auth/callback/google`.
   A mismatch here is the usual cause of `Error 400: redirect_uri_mismatch`.
3. If the consent screen is unpublished, add your account under **Test users**.
4. Put the ID and secret in `.env`, then restart the server.

### Commands

- `npm run dev` — dev server with hot reload
- `npm run build` — production build
- `npm start` — serve production build
- `npm run db:up` — start Postgres container
- `npm run db:down` — stop container
- `npm run db:migrate` — create / apply migrations (dev)
- `npm run db:studio` — open Prisma Studio (visual DB browser)

## Deploying

**Vercel + hosted Postgres (Neon / Supabase / Vercel Postgres):**

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add a hosted Postgres (Neon is free-tier friendly). Copy its `DATABASE_URL`.
4. In Vercel → Project → Settings → Environment Variables:
   - `DATABASE_URL` — your hosted Postgres URL
   - `AUTH_SECRET` — `openssl rand -base64 32` (generate a **new** one, don't reuse dev's)
   - `NEXTAUTH_URL` — your Vercel URL (e.g. `https://tracker.vercel.app`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional; also add
     `https://<your-domain>/api/auth/callback/google` to the Google client's
     authorised redirect URIs
   - `SMTP_*` and `MAIL_FROM` — **required in production** if you want the email
     OTP flow to work; without them the OTP endpoint returns an error rather
     than silently dropping codes
5. Deploy. First deploy will run `prisma generate` via `postinstall`.
6. Run migrations against prod once: `DATABASE_URL="..." npx prisma migrate deploy`.

## Data flow — where writes happen

Every change to your entries goes through an API route that verifies the session
and scopes queries by `userId`. No client-side database access. Each user only
sees their own entries.

| Action | Route | DB operation |
|---|---|---|
| Sign up | `POST /api/auth/signup` | `prisma.user.create` |
| Sign in (password) | `POST /api/auth/[...nextauth]` | Bcrypt compare, JWT cookie |
| Request OTP | `POST /api/auth/otp` | `prisma.loginCode.create` (bcrypt hash of the code; rate-limited) |
| Sign in (OTP / Google) | `POST /api/auth/[...nextauth]` | Verify + `prisma.user.upsert`, JWT cookie |
| Load entries | `GET /api/entries?month=YYYY-MM` | `prisma.entry.findMany` (scoped to `userId`) |
| Add entry | `POST /api/entries` | `prisma.entry.create` |
| Edit entry | `PATCH /api/entries/[id]` | Ownership check + `prisma.entry.update` |
| Delete entry | `DELETE /api/entries/[id]` | Ownership check + `prisma.entry.delete` |
| Bulk import | `POST /api/entries/bulk` | `prisma.entry.createMany` in a tx (optional `replace: true` wipes first) |
| Import JSON | `POST /api/import/json` | Parses + `createMany` |
| Import PDF | `POST /api/import/pdf` | Extracts rows, returns for review; user confirms → hits `/api/entries/bulk` |
| Export JSON | `GET /api/export/json` | `findMany` → JSON attachment |
| Export PDF | `GET /api/export/pdf?month=YYYY-MM` | `findMany` → jsPDF report |

## PDF bank-statement import

Upload a HDFC/ICICI/SBI statement PDF. The parser:

1. Extracts text via `pdf-parse`.
2. Groups lines that start with `dd/mm/yy` into rows.
3. Reads the last two decimal numbers on each row as `amount` and `closing balance`.
4. Determines direction by comparing each row's balance to the previous row's — increase = deposit, decrease = expense.
5. Skips rows below ₹10 (matching your earlier rule).
6. Guesses a category from narration keywords (`swiggy` → Food, `uber` → Travel, `HLIC` → Investment, etc.).

The result is shown in a review table — you can uncheck rows to skip, edit categories, then bulk-save.

Parser lives at `src/lib/pdf-bank-parser.ts` — extend keyword rules there if you use another bank.

## Import your existing JSON

Use **Upload JSON** in the Import panel — accepts both the legacy v1 export
(from the single-file HTML tracker) and the new v2 export (from this app).

## Deleting all your entries

Prisma Studio (`npm run db:studio`) or delete rows in the entries table one at a time
via the UI. The API has no "clear all" endpoint by default — add one if you need it,
using `prisma.entry.deleteMany({ where: { userId } })` behind an auth check.

## What's NOT included (add if needed)

- Dedicated password reset flow (the email OTP login covers most of the need —
  a user locked out of their password can still sign in with a code)
- GitHub / other OAuth providers (Google is wired up; others follow the same shape)
- Rate limiting on the password auth routes (the OTP endpoint is rate-limited:
  5 codes per 10-minute window, 5 verification attempts per code)
- Server-side pagination on the entries list (fine up to a few thousand entries per user)
- Family sharing (would need an `Account` model owning entries, with per-user permissions)
