import { Metadata } from 'next';
import { ComingSoon } from '../../../components/ui/coming-soon';

export const metadata: Metadata = { title: 'Documentos' };

export default function DocumentsPage() {
  return <ComingSoon title="Documentos" description="Documentos gerados" />;
}
