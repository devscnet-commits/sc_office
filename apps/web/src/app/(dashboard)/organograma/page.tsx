import { Metadata } from 'next';
import { OrgChart } from '../../../components/organograma/org-chart';

export const metadata: Metadata = { title: 'Organograma' };

export default function OrganogramaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organograma</h1>
        <p className="text-muted-foreground">Estrutura hierárquica da organização.</p>
      </div>
      <OrgChart />
    </div>
  );
}
