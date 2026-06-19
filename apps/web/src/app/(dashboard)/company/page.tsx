import { Metadata } from 'next';
import { CompanyClient } from '../../../components/company/company-client';

export const metadata: Metadata = { title: 'Empresa' };

export default function CompanyPage() {
  return <CompanyClient />;
}
