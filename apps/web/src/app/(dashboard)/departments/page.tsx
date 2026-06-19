import { Metadata } from 'next';
import { ComingSoon } from '../../../components/ui/coming-soon';

export const metadata: Metadata = { title: 'Departamentos' };

export default function DepartmentsPage() {
  return <ComingSoon title="Departamentos" description="Estrutura organizacional" />;
}
