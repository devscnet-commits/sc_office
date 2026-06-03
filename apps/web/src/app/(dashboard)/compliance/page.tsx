import { Metadata } from 'next';
import { ExpirationDashboard } from '../../../components/compliance/expiration-dashboard';

export const metadata: Metadata = { title: 'Compliance Documental' };

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Documental</h1>
        <p className="text-muted-foreground">
          Monitore vencimentos e pendências documentais dos funcionários.
        </p>
      </div>
      <ExpirationDashboard />
    </div>
  );
}
