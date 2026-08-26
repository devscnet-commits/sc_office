'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FilePlus, Eye, CheckCircle2, AlertTriangle, FileCheck, Users, User } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

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

type TargetMode = 'employee' | 'department';

export function GenerateDocumentClient() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [dossierFolderId, setDossierFolderId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  const { data: tplData } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/templates') as any });
  const templates = unwrap(tplData);

  const { data: empData } = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/employees?limit=500') as any });
  const employees = unwrap(empData);

  const { data: deptData } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments') as any });
  const departments = unwrap(deptData);

  // Funcionários do departamento selecionado
  const { data: deptEmpData } = useQuery({
    queryKey: ['employees-by-department', departmentId],
    queryFn: () => api.get(`/employees?departmentId=${departmentId}&limit=500`) as any,
    enabled: targetMode === 'department' && !!departmentId,
  });
  const departmentEmployees = unwrap(deptEmpData);

  // Pastas do dossiê do funcionário selecionado (para escolher onde salvar) — apenas modo funcionário
  const { data: folderData } = useQuery({
    queryKey: ['dossier-tree', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}/dossier`) as any,
    enabled: targetMode === 'employee' && !!employeeId,
  });
  const flattenFolders = (nodes: any[], acc: any[] = []): any[] => {
    for (const n of nodes ?? []) {
      acc.push(n);
      if (n.children?.length) flattenFolders(n.children, acc);
    }
    return acc;
  };
  const folders = flattenFolders(folderData?.data ?? []);

  const previewMutation = useMutation({
    mutationFn: () => api.post('/documents/preview', { templateId, employeeId }) as any,
    onSuccess: (resp: any) => setPreview(resp?.data ?? resp),
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar pré-visualização'),
  });

  const generateMutation = useMutation({
    mutationFn: (force: boolean) =>
      api.post('/documents/generate', {
        templateId,
        employeeId,
        forceGenerate: force,
        dossierFolderId: dossierFolderId || undefined,
      }),
    onSuccess: () => { toast.success('Documento gerado com sucesso'); router.push('/documents'); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar documento'),
  });

  const generateBatchMutation = useMutation({
    mutationFn: (force: boolean) =>
      api.post('/documents/generate-batch', {
        templateId,
        employeeIds: departmentEmployees.map((e: any) => e.id),
        forceGenerate: force,
      }) as any,
    onSuccess: (resp: any) => {
      const data = resp?.data ?? resp;
      if (data.failed > 0) {
        toast.warning(`${data.succeeded} documento(s) gerado(s), ${data.failed} falharam`);
      } else {
        toast.success(`${data.succeeded} documento(s) gerado(s) com sucesso`);
      }
      router.push('/documents');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar documentos em lote'),
  });

  const readyEmployee = templateId && employeeId;
  const readyDepartment = templateId && departmentId && departmentEmployees.length > 0;
  const canGenerate = preview?.compliance?.canGenerate ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerar Documento</h1>
        <p className="text-muted-foreground">Selecione um modelo e um funcionário (ou um departamento inteiro) — os dados são preenchidos automaticamente.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FilePlus className="h-4 w-4" /> Seleção</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo (template)</Label>
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setPreview(null); }}>
              <SelectTrigger className="md:max-w-md"><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Gerar para</Label>
            <Tabs
              value={targetMode}
              onValueChange={(v) => {
                setTargetMode(v as TargetMode);
                setPreview(null);
                setEmployeeId('');
                setDepartmentId('');
                setDossierFolderId('');
              }}
            >
              <TabsList>
                <TabsTrigger value="employee" className="gap-1"><User className="h-3.5 w-3.5" /> Funcionário</TabsTrigger>
                <TabsTrigger value="department" className="gap-1"><Users className="h-3.5 w-3.5" /> Departamento</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {targetMode === 'employee' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Funcionário</Label>
                <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setDossierFolderId(''); setPreview(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um funcionário" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.fullName}{e.matricula ? ` (${e.matricula})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pasta no dossiê (onde salvar)</Label>
                <Select value={dossierFolderId} onValueChange={setDossierFolderId} disabled={!employeeId}>
                  <SelectTrigger><SelectValue placeholder={employeeId ? 'Contratos (padrão)' : 'Escolha o funcionário primeiro'} /></SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se não escolher, o documento vai para a pasta <strong>Contratos</strong>.</p>
              </div>
              <div className="md:col-span-2">
                <Button variant="outline" disabled={!readyEmployee || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMutation.isPending ? 'Gerando prévia...' : 'Pré-visualizar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 md:max-w-md">
                <Label>Departamento</Label>
                <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setPreview(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um departamento" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {departmentId && (
                <div className="rounded-md border p-3 text-sm">
                  {departmentEmployees.length > 0 ? (
                    <>
                      <p className="font-medium">
                        {departmentEmployees.length} funcionário(s) neste departamento — o documento será gerado individualmente para cada um.
                      </p>
                      <p className="text-muted-foreground mt-1 max-h-32 overflow-y-auto">
                        {departmentEmployees.map((e: any) => e.fullName).join(', ')}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Nenhum funcionário ativo neste departamento.</p>
                  )}
                </div>
              )}

              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Ao gerar por departamento, o documento é criado direto para todos os funcionários listados (sem pré-visualização individual) e vai para a pasta padrão <strong>Contratos</strong> do dossiê de cada um. Pendências de compliance de um funcionário não impedem a geração para os demais.
              </div>

              <Button
                disabled={!readyDepartment || generateBatchMutation.isPending}
                onClick={() => generateBatchMutation.mutate(false)}
              >
                {generateBatchMutation.isPending
                  ? 'Gerando documentos...'
                  : `Gerar documento para ${departmentEmployees.length || 0} funcionário(s)`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {targetMode === 'employee' && preview && (
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
