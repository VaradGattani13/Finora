import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SessionProvider from '@/components/SessionProvider';
import ImportProvider from '@/components/ImportProvider';
import UserMenu from '@/components/UserMenu';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return (
    <SessionProvider>
      <ImportProvider>
        <div className="shell">
          <header
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 18, flexWrap: 'wrap', gap: 10,
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Expense Tracker</h1>
            <UserMenu name={session.user.name} email={session.user.email} />
          </header>
          {children}
        </div>
      </ImportProvider>
    </SessionProvider>
  );
}
