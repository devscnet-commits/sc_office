'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { FolderOpen, Download, FilePlus } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface GeneratedDocument {
  id: string;
  name: string | null;
  status: string;
  createdAt: string;
  template?: { name: string; format: string } | null;
  employee?: { fullName: string; matricula: string } | null;
}

const unwrap = (resp: any): GeneratedDocument[] =>
  Array.isArray(resp?.data) ? resp.data : resp?.data?.data ?? [];

const STATUS: Record<string, { label: string; cls: string }> = {
  GENERATED: { label: 'Gerado', cls: 'bg-blue-100 text-blue-800' },
  SIGNED: { label: 'Assinado', cls: 'bg-green-100 text-green-800' },
  ARCHIVED: { label: 'Arquivado', cls: 'bg-gray-100 text-gray-800' },
  DRAFT: { label: 'Rascunho', cls: 'bg-yellow-100 text-yellow-800' },
};

export function DocumentsClient() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get('/documents') as any,
  });
  const documents = unwrap(data);

  const handleDownload = async (doc: GeneratedDocument) => {
    setDownloading(doc.id);
    try {
      const blob: any = await api.get(`/documents/${doc.id}/download?format=pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name || doc.template?.name || 'documento'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar o documento');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground">Documentos gerados a partir dos templates.</p>
        </div>
        <Link href="/documents/generate">
          <Button><FilePlus className="h-4 w-4 mr-2" /> Gerar Documento</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> {documents.length} documento(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>}
              {!isLoading && documents.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum documento gerado ainda.</TableCell></TableRow>
              )}
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name || doc.template?.name || 'Documento'}</TableCell>
                  <TableCell>{doc.employee?.fullName || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{doc.template?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS[doc.status]?.cls}>{STATUS[doc.status]?.label || doc.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4 mr-1" />
                      {downloading === doc.id ? '...' : 'PDF'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
