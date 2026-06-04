import { Metadata } from 'next';
import { UsersClient } from '../../../components/users/users-client';

export const metadata: Metadata = { title: 'Usuários' };

export default function UsersPage() {
  return <UsersClient />;
}
