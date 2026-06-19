import { Metadata } from 'next';
import { AuditClient } from '../../../components/audit/audit-client';

export const metadata: Metadata = { title: 'Auditoria' };

export default function AuditPage() {
  return <AuditClient />;
}
