import { Metadata } from 'next';
import { GenerateDocumentClient } from '../../../../components/documents/generate-client';

export const metadata: Metadata = { title: 'Gerar Documento' };

export default function GenerateDocumentPage() {
  return <GenerateDocumentClient />;
}
