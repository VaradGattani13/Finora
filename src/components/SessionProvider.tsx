'use client';
import { SessionProvider as NAProvider } from 'next-auth/react';
export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NAProvider>{children}</NAProvider>;
}
