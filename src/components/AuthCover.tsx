import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import Wordmark from './Wordmark';
import AuthDemo from './AuthDemo';
import CurrencyGlyphs from './CurrencyGlyphs';

/** Left-hand cover on the sign-in and sign-up screens. Hidden below 900px so
 *  the form gets the whole phone screen. */
export default function AuthCover() {
  return (
    <aside className="auth-cover">
      <CurrencyGlyphs />
      <Link href="/" className="auth-cover-brand"><Wordmark /></Link>

      <div className="auth-cover-body">
        <h2>{BRAND.tagline}</h2>
        <p>
          Budgets that warn you before you overspend, recurring rent and bills that log
          themselves, and twelve months of trend in a single glance.
        </p>
      </div>

      {/* The bullets live inside the demo — each one is the chapter button for
          the scene that proves it. */}
      <AuthDemo />
    </aside>
  );
}
