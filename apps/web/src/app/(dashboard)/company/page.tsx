import { Metadata } from 'next';
import { ComingSoon } from '../../../components/ui/coming-soon';

export const metadata: Metadata = { title: 'Empresa' };

export default function CompanyPage() {
  return <ComingSoon title="Empresa" description="Dados da empresa" />;
}
