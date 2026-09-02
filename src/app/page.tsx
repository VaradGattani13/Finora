import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import Wordmark from '@/components/Wordmark';

/** Public landing page. A signed-in visitor skips straight to their dashboard. */
export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect('/dashboard');

  return (
    <main className="landing">
      <header className="landing-nav">
        <Wordmark />
        <nav className="landing-nav-links">
          <Link className="btn-secondary" href="/login">Sign in</Link>
          <Link className="btn" href="/signup">Create account</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <p className="eyebrow">Personal finance, no spreadsheet</p>
        <h1>{BRAND.tagline}</h1>
        <p className="lede">
          {BRAND.name} turns a month of messy UPI payments into something you can actually read:
          what you spent, where it went, and whether that is better or worse than last month.
        </p>
        <div className="landing-cta">
          <Link className="btn" href="/signup">Start tracking — free</Link>
          <Link className="btn-secondary" href="/login">I already have an account</Link>
        </div>
        <p className="muted-note">Your data stays in your account. Export it as CSV or JSON whenever you want.</p>
      </section>

      <section className="landing-preview" aria-hidden>
        {/* A miniature of the real dashboard, drawn from the same design tokens. */}
        <div className="preview-card">
          <div className="preview-tiles">
            <div className="preview-tile"><span>Deposits</span><strong className="pos">₹20,000</strong></div>
            <div className="preview-tile"><span>Spends</span><strong className="neg">₹10,000</strong></div>
            <div className="preview-tile"><span>Net</span><strong className="pos">₹10000</strong></div>
          </div>
          <div className="preview-bars">
            {[38, 62, 45, 80, 55, 92, 48, 70, 35, 88, 60, 74].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="preview-budget">
            <span className="preview-budget-label">Food</span>
            <span className="bar-track" style={{ height: 6 }}>
              <span className="bar-fill bud-warn" style={{ width: '84%', display: 'block', height: '100%' }} />
            </span>
            <span className="preview-budget-pct">40% of ₹10000</span>
          </div>
        </div>
      </section>

      <section className="landing-features">
        {[
          ['Budgets that warn you', 'Set a monthly cap per category. Progress bars fill as you spend, you get a heads-up at 80%, and a clear flag when you cross it.'],
          ['Recurring entries', 'Rent, broadband, SIP — set the rule once. The entry appears on the right day each month, and stays deleted if you remove it.'],
          ['A year of trend', 'Deposits, spends and net across twelve months on one line chart, so a bad month is obvious in context instead of in isolation.'],
          ['Month vs month', 'Every category compared against last month, clipped to the same day so a half-finished month never looks like a win.'],
          ['Import a statement', 'Bring in a bank PDF or a JSON export instead of typing a hundred rows by hand.'],
          ['Yours to take', 'CSV for spreadsheets, JSON for backups, PDF for records. One click, no upsell, no lock-in.'],
        ].map(([title, body]) => (
          <article key={title} className="feature">
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <footer className="landing-foot">
        <Wordmark small />
        <span className="muted-note" style={{ margin: 0 }}>
          Built for tracking real money, not demo data.
        </span>
      </footer>
    </main>
  );
}
