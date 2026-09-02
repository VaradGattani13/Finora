import { BRAND } from '@/lib/brand';

export const metadata = { title: `Offline — ${BRAND.name}` };

export default function OfflinePage() {
  return (
    <div className="auth-shell">
      <div className="panel" style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 className="onboard-title">You are offline</h1>
        <p className="muted-note">
          {BRAND.name} needs a connection to load your entries. Your data is safe —
          reopen this page once you are back online.
        </p>
      </div>
    </div>
  );
}
