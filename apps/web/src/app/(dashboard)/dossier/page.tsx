import { Metadata } from 'next';
import { DossierClient } from '../../../components/dossier/dossier-client';

export const metadata: Metadata = { title: 'Dossiês' };

export default function DossierPage() {
  return <DossierClient />;
}
