import { Metadata } from 'next';
import { ComingSoon } from '../../../../components/ui/coming-soon';

export const metadata: Metadata = { title: 'Gerar Documento' };

export default function GenerateDocumentPage() {
  return (
    <ComingSoon
      title="Gerar Documento"
      description="Geração de documentos a partir de templates"
    />
  );
}
