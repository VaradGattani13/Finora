/**
 * Single source of truth for product naming. The landing page, login cover,
 * page titles and the PWA manifest all read from here, so renaming the product
 * is a one-line change (plus public/manifest.webmanifest, which cannot import).
 */
export const BRAND = {
  name: 'Finealth',
  /** Shown under the wordmark on the landing hero and the login cover. */
  tagline: 'Know exactly where the money went.',
  /** One sentence, used for <meta name="description"> and social previews. */
  description:
    'A private expense tracker for people who want the real numbers — monthly budgets with alerts, recurring entries, and a year of trends in one view.',
} as const;
