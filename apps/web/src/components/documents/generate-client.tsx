'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FilePlus, Eye, CheckCircle2, AlertTriangle, FileCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const unwrap = (resp: any): any[] => (Array.isArray(resp?.data) ? resp.data : resp?.data?.data ?? []);

interface Compliance {
  canGenerate: boolean;
  blockerCount?: number;
  requirements?: any[];
}
interface Preview {
  html: string;
  compliance: Compliance;
}

export function GenerateDocumentClient() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  const { data: tplData } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/templates') as any });
  const templates = unwrap(tplData);

  const { data: empData } = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/employees?limit=500') as any });
  const employees = unwrap(empData);

  const previewMutation = useMutation({
    mutationFn: () => api.post('/documents/preview', { templateId, employeeId }) as any,
    onSuccess: (resp: any) => setPreview(resp?.data ?? resp),
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar pré-visualização'),
  });

  const generateMutation = useMutation({
    mutationFn: (force: boolean) =>
      api.post('/documents/generate', { templateId, employeeId, forceGenerate: force }),
    onSuccess: () => { toast.success('Documento gerado com sucesso'); router.push('/documents'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar documento'),
  });

  const ready = templateId && employeeId;
  const canGenerate = preview?.compliance?.canGenerate ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerar Documento</h1>
        <p className="text-muted-foreground">Selecione um modelo e um funcionário — os dados são preenchidos automaticamente.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FilePlus className="h-4 w-4" /> Seleção</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Modelo (template)</Label>
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setPreview(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Funcionário</Label>
            <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setPreview(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um funcionário" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.fullName}{e.matricula ? ` (${e.matricula})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button variant="outline" disabled={!ready || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
              <Eye className="h-4 w-4 mr-2" />
              {previewMutation.isPending ? 'Gerando prévia...' : 'Pré-visualizar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><FileCheck className="h-4 w-4" /> Pré-visualização</span>
              {canGenerate
                ? <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Pronto para gerar</Badge>
                : <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{preview.compliance?.blockerCount || 0} pendência(s)</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canGenerate && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Há pendências de compliance para este funcionário.</p>
                <p className="text-muted-foreground mt-1">Você pode resolver as pendências ou gerar mesmo assim (registro de exceção).</p>
              </div>
            )}
            <div
              className="rounded-md border bg-white p-6 text-black max-h-[480px] overflow-y-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
            <div className="flex gap-2 justify-end">
              {canGenerate ? (
                <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(false)}>
                  {generateMutation.isPending ? 'Gerando...' : 'Gerar documento'}
                </Button>
              ) : (
                <Button variant="destructive" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(true)}>
                  {generateMutation.isPending ? 'Gerando...' : 'Gerar mesmo assim'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
