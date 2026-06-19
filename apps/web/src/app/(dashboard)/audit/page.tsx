import { Metadata } from 'next';
import { ComingSoon } from '../../../components/ui/coming-soon';

export const metadata: Metadata = { title: 'Auditoria' };

export default function AuditPage() {
  return <ComingSoon title="Auditoria" description="Logs de auditoria do sistema" />;
}
