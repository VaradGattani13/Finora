# Session handoff — 2026-08-20

Work log for the UI + auth overhaul. Picks up tomorrow from "Open items".

---

## 1. Themes (light / dark / system + 2 extras)

`data-theme` on `<html>` is the single source of truth. `ThemeProvider` always
stamps a concrete theme, so CSS never has to guess.

| File | Change |
|---|---|
| `src/app/globals.css` | Rewritten. Full token set per theme: `light`, `dark`, `midnight` (deep navy), `sepia` (warm paper). New tokens: `--surface-2`, `--border-strong`, `--accent`, `--accent-soft`, `--danger-soft`, `--good-soft`, `--menu-bg`, `--shadow`. |
| `src/components/ThemeProvider.tsx` | **New.** `THEMES` list, `useTheme()`, persists to `localStorage['etnx-theme']`. `system` tracks OS via `matchMedia`; an explicit pick stays put. |
| `src/app/layout.tsx` | Inlines `THEME_BOOTSTRAP` in `<head>` so the first painted frame is already themed (no flash). `suppressHydrationWarning` on `<html>` because the script mutates it pre-hydration. |

`prefers-color-scheme` block is kept **only** as a no-JS / pre-hydration
fallback, scoped to `:root:not([data-theme])`.

Switch themes: avatar menu → Theme.

---

## 2. Form alignment fix (amount / note overlap)

Root cause: the form was a fixed 6-column grid (`130px 130px 1fr 140px 1fr auto`)
with `align-items: end`. Below a certain width the `1fr` columns collapsed and
inputs overlapped their neighbours.

- New `.field-grid` / `.field` classes in `globals.css` — labels sit **above**
  controls in a flex column, so they can never overlay an adjacent input.
- Every input got `min-width: 0`, which lets grid children shrink instead of
  overflowing (this is the actual overlap fix — grid items default to
  `min-width: auto`).
- Columns are now `minmax()` based and wrap cleanly.
- Submit buttons moved out of the grid onto their own row.
- `CategoryCombobox` gained an `id` prop so labels can be properly associated.

---

## 3. Month-on-month comparison

`src/components/MonthComparison.tsx` — **new**.

- Compares the viewed month against the previous month, **clipped to the same
  day of month** so it is like-for-like. Cutoff = today's date for the current
  month, full month length for a past month.
- Four headline metrics (deposits / spends / net / entry count) each with
  absolute delta, % change, and the prior value.
- Per-category table with paired bars (current vs previous) and per-category change.
- Colour polarity is per-metric: spends rising is red, deposits rising is green.
- `DeltaLine` is also reused on the dashboard tiles.

Tile deltas are **hidden while a search or date filter is active** — comparing a
filtered subtotal against an unfiltered baseline would be misleading.

`Dashboard.tsx` now fetches the previous month alongside the current one.

---

## 4. Header restructure — initials avatar menu

| File | Change |
|---|---|
| `src/components/UserMenu.tsx` | **New.** Initials avatar (derived from name, else email local-part). Opens on hover **and** click. `Import ▸` submenu (JSON / bank statement PDF), `Theme ▸` submenu, then `Sign out`. Closes on click-outside and Escape; 220 ms grace timer so the pointer can cross the gap to the panel. |
| `src/components/ImportProvider.tsx` | **New.** Owns the whole import flow: hidden file inputs, toast feedback, PDF review modal, and a `version` counter the dashboard watches to refetch after an import. |
| `src/app/dashboard/layout.tsx` | Renders `UserMenu` instead of the old sign-out button; wraps children in `ImportProvider`. |
| `ImportPanel.tsx`, `SignOutButton.tsx` | **Deleted** — superseded. |

The import panel no longer occupies space in the page body; the PDF review table
is a modal.

---

## 5. Authentication

### Google OAuth
- Provider registered **only** when `GOOGLE_CLIENT_ID` **and**
  `GOOGLE_CLIENT_SECRET` are both set (`googleEnabled`). Otherwise the button is
  hidden on both `/login` and `/signup` — a visible button with no credentials
  bounces the user back to the sign-in page, which is what happened mid-session.
- `prompt: 'select_account'` forces the account chooser; without it Google
  silently reuses whichever session is already active.
- **Confirmed working end-to-end by the user.**

### Email OTP (passwordless)
| File | Purpose |
|---|---|
| `src/lib/otp.ts` | **New.** 6-digit code via `crypto.randomInt`. Only the **bcrypt hash** is stored. 10-min TTL, max 5 codes per window, max 5 verify attempts, issuing a new code invalidates the old one. |
| `src/lib/mailer.ts` | **New.** nodemailer. With no SMTP configured, prints the code to the server console in dev and **throws in production** so codes are never silently dropped. |
| `src/app/api/auth/otp/route.ts` | **New.** Issues + emails a code. Response never reveals whether the address is already registered. |

### Security fixes made during the session
- **Removed `allowDangerousEmailAccountLinking: true`.** It silently merged a
  Google sign-in into an existing password account with the same address — an
  account-takeover path. Now returns `?error=AccountExists`.
- `signIn` requires Google to positively assert `email_verified === true`.
- **Split the auth config for the Edge runtime.** `src/lib/auth.config.ts` (new)
  holds the edge-safe half; `middleware.ts` builds from that alone. Previously
  middleware imported the full config, dragging Prisma, bcrypt and `crypto` into
  Edge where they don't work. Middleware bundle: **112 kB → 74.5 kB**.
- `?error=` codes are now surfaced on the login form (`AUTH_ERRORS` map) instead
  of a silent bounce.

### Pages
`login/page.tsx` and `signup/page.tsx` are now server components that read
`googleEnabled` and pass it to new client components `LoginForm.tsx` /
`SignupForm.tsx`.

---

## 6. Database

Schema (`prisma/schema.prisma`):
- `User.passwordHash` → **nullable** (Google/OTP accounts never set one)
- `User.image`, `User.emailVerified` added
- `LoginCode` model added

Migration `20260820000000_auth_google_and_otp` — **applied to the Neon DB.**
Purely additive/widening, no data loss.

---

## 7. Repo prep for GitHub

- **`.env.example` scrubbed** — it had accumulated real Google credentials and
  the Neon password. That file is committed; `.env` is not. Real values now live
  only in `.env`.
- `.gitignore` hardened: `.env` + `.env.*` with an `!.env.example` exception.
- `next.config.js` — was using `serverExternalPackages` (Next **15** name),
  silently ignored on Next 14.2.14, so `pdf-parse`/`bcryptjs` were never
  actually externalised. Now `experimental.serverComponentsExternalPackages`,
  plus `nodemailer`.
- `docker-compose.yml` — Postgres credentials/port/container name parameterized
  with local-dev defaults.
- `README.md` — full env var table, graceful-degradation rules, Google setup
  walkthrough (including the `redirect_uri_mismatch` trap), production env vars.

Verified: `grep` for every known secret across the tree returns matches **only**
in `.env`; `git check-ignore` confirms `.env` excluded, `.env.example` tracked;
56 files would be committed.

---

## Verified vs not

**Verified**
- `npx tsc --noEmit` clean after every change
- Full `npm run build` succeeded (before the dev server took the `.next` lock)
- OTP issuance tested end-to-end — code generated, hashed, stored, printed
- Google sign-in — confirmed working by the user
- `/dashboard` returns 307 to `/login` when signed out (Edge middleware works)
- Google button correctly hidden on both pages when credentials are absent

**Not verified**
- OTP **verification** step end-to-end (stopped mid-test; issuance half is proven)
- Themes, comparison panel, and import menu were not visually checked in a
  browser by me — they typecheck and build, but nobody has clicked through them
- A final `npm run build` after the last few edits (blocked by the `.next` lock)

---

## Open items for tomorrow

1. **OTP collision policy — needs a decision.** Currently inconsistent:
   - Google sign-in onto an existing password account → **errors**
   - OTP onto an existing password account → **signs straight in**

   Either allow both (inbox access is the same proof a password reset relies on
   — my recommendation, and it gives a passwordless fallback), or error on both
   (stricter, but no recovery path if the password is lost). Whichever you pick,
   make them match.

2. **Run `npm run build`** with the dev server stopped, to confirm a clean
   production build before pushing.

3. **Stray `LoginCode` row** for a personal address is still in the DB — expired
   and inert (bcrypt hash only), left in place at your request. Delete when
   convenient.

4. **`git init` was run inside `etnx/`.** Nothing committed or staged. If you
   want the repo rooted at the parent folder, delete `etnx/.git` and re-init one
   level up.

5. **Optional:** rotate the Google client secret. It was never committed and
   never left the machine, so this is precautionary only.

---

## Resuming

```bash
cd etnx
npm run dev          # http://localhost:3000
```

OTP codes print to that terminal while `SMTP_HOST` is blank.
`NEXTAUTH_URL` is `http://localhost:3000` — if you change the port, update it
**and** add the matching redirect URI in Google Cloud Console.
