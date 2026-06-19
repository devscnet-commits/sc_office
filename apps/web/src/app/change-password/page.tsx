import { Metadata } from 'next';
import { ChangePasswordClient } from '../../components/auth/change-password-client';

export const metadata: Metadata = { title: 'Trocar senha' };

export default function ChangePasswordPage() {
  return <ChangePasswordClient />;
}
