'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import GoogleButton from './GoogleButton';

export default function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error?.formErrors?.[0] || data.error || 'Signup failed');
      setBusy(false);
      return;
    }
    await signIn('credentials', { email, password, redirect: false });
    router.push('/dashboard');
  }

  return (
    <form onSubmit={submit} className="panel" style={{ width: 380, maxWidth: '100%' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px' }}>Create account</h1>

      {/* Only offered when the provider is actually configured — otherwise the
          click would bounce off an unregistered provider back to /login. */}
      {googleEnabled && (
        <>
          <GoogleButton />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        {err && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{typeof err === 'string' ? err : JSON.stringify(err)}</div>}
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 14 }}>
        Already registered? <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        <br />
        Prefer no password? <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in with an email code</Link>
      </div>
    </form>
  );
}
