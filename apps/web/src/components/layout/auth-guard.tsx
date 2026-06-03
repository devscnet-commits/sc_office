'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth.store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.mustChangePassword) {
      router.replace('/change-password');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
