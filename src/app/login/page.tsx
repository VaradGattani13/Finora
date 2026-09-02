import { Suspense } from 'react';
import { googleEnabled } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';
import AuthCover from '@/components/AuthCover';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="auth-split">
      <AuthCover />
      <div className="auth-pane">
        <div className="auth-pane-inner">
          <Suspense fallback={<div className="panel">Loading…</div>}>
            <LoginForm googleEnabled={googleEnabled} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
