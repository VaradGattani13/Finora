'use client';
import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import GoogleButton from './GoogleButton';

type Mode = 'password' | 'otp';

/** Codes NextAuth (or our signIn callback) can bounce back on the URL. */
const AUTH_ERRORS: Record<string, string> = {
  AccountExists:
    'This email already has a password account. Sign in with your password instead.',
  GoogleUnverified: 'Google has not verified that email address.',
  GoogleNoEmail: 'Google did not return an email address for that account.',
  OAuthSignin: 'Could not start Google sign-in. It may not be configured on this server.',
  OAuthCallback: 'Google sign-in failed on the way back. Check the redirect URI configuration.',
  OAuthAccountNotLinked:
    'That email is already registered by another sign-in method. Use the method you signed up with.',
  Configuration: 'Sign-in is misconfigured on this server. Check the server logs.',
  AccessDenied: 'Access denied.',
};

export default function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('callbackUrl') || '/dashboard';

  // A failed provider round-trip lands back here with ?error=… — surface it
  // rather than silently re-showing the form.
  const urlError = sp.get('error');
  useEffect(() => {
    if (urlError) setErr(AUTH_ERRORS[urlError] ?? `Sign-in failed (${urlError}).`);
  }, [urlError]);

  // Resend cooldown so the request endpoint is not hammered.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (codeSent) codeRef.current?.focus(); }, [codeSent]);

  function switchMode(m: Mode) {
    setMode(m); setErr(''); setNotice(''); setCodeSent(false); setCode('');
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setErr('Invalid email or password.');
    else router.push(next);
  }

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(''); setNotice(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the code.');
      setCodeSent(true);
      setCooldown(30);
      setNotice(
        data.delivered === false
          ? `Email is not configured on this server — the code was printed to the server log. Expires in ${data.expiresInMinutes} min.`
          : `Code sent to ${email}. It expires in ${data.expiresInMinutes} minutes.`
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const res = await signIn('email-otp', { email, code, purpose: 'login', redirect: false });
    setBusy(false);
    if (res?.error) setErr('That code is not valid or has expired.');
    else router.push(next);
  }

  return (
    <form
      onSubmit={mode === 'password' ? signInWithPassword : codeSent ? verifyOtp : requestCode}
      className="panel"
      style={{ width: 380, maxWidth: '100%' }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Sign in</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
        Track spends, deposits and month-on-month trends.
      </p>

      {googleEnabled && (
        <>
          <GoogleButton callbackUrl={next} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
        </>
      )}

      {/* Mode switch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['password', 'otp'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className="btn-secondary"
            style={{
              flex: 1,
              background: mode === m ? 'var(--accent-soft)' : 'transparent',
              color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: mode === m ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {m === 'password' ? 'Password' : 'Email code'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (codeSent) { setCodeSent(false); setCode(''); setNotice(''); } }}
          required
          autoComplete="email"
        />

        {mode === 'password' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        )}

        {mode === 'otp' && codeSent && (
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoComplete="one-time-code"
            style={{ letterSpacing: '0.4em', fontSize: 17, textAlign: 'center' }}
          />
        )}

        {notice && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{notice}</div>}
        {err && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{err}</div>}

        <button type="submit" className="btn" disabled={busy}>
          {busy
            ? 'Working…'
            : mode === 'password'
              ? 'Sign in'
              : codeSent
                ? 'Verify and continue'
                : 'Email me a code'}
        </button>

        {mode === 'otp' && codeSent && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || cooldown > 0}
            onClick={() => requestCode()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 16 }}>
        {mode === 'otp'
          ? 'No account yet? The code verifies your email and creates one.'
          : <>No account? <Link href="/signup" style={{ color: 'var(--accent)' }}>Create one</Link></>}
      </div>
    </form>
  );
}
