import { Metadata } from 'next';
import { DocumentsClient } from '../../../components/documents/documents-client';

export const metadata: Metadata = { title: 'Documentos' };

export default function DocumentsPage() {
  return <DocumentsClient />;
}
