import { googleEnabled } from '@/lib/auth';
import SignupForm from '@/components/SignupForm';
import AuthCover from '@/components/AuthCover';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <div className="auth-split">
      <AuthCover />
      <div className="auth-pane">
        <div className="auth-pane-inner">
          <SignupForm googleEnabled={googleEnabled} />
        </div>
      </div>
    </div>
  );
}
