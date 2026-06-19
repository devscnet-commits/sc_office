'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, AlertCircle, Clock, Users, CalendarPlus, Info, FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { usePermissions } from '../../stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface ExpirationEntry {
  employeeId: string;
  employeeName: string;
  documentType: string;
  label: string;
  expirationDate: string;
  daysUntilExpiration: number;
  status: string;
}

interface Dashboard {
  expired: ExpirationEntry[];
  critical: ExpirationEntry[];
  expiringSoon: ExpirationEntry[];
  totalEmployeesWithPendencies: number;
}

// Tipos de documento que normalmente possuem validade / vencimento
const DOC_TYPES = [
  { value: 'ASO', label: 'ASO (Atestado de Saúde Ocupacional)' },
  { value: 'CNH', label: 'CNH' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'TREINAMENTO', label: 'Treinamento (NR, etc.)' },
  { value: 'CONTRATO', label: 'Contrato (experiência/temporário)' },
  { value: 'RG', label: 'RG' },
  { value: 'CPF', label: 'CPF' },
  { value: 'CTPS', label: 'Carteira de Trabalho' },
  { value: 'COMPROVANTE_ENDERECO', label: 'Comprovante de Endereço' },
  { value: 'RESERVISTA', label: 'Certificado de Reservista' },
  { value: 'TITULO_ELEITOR', label: 'Título de Eleitor' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'OUTRO', label: 'Outro' },
];

function ExpirationTable({ items, emptyText }: { items: ExpirationEntry[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">{emptyText}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Funcionário</TableHead>
          <TableHead>Documento</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, i) => (
          <TableRow key={`${item.employeeId}-${item.documentType}-${i}`}>
            <TableCell className="font-medium">{item.employeeName}</TableCell>
            <TableCell>{item.label}</TableCell>
            <TableCell>{formatDate(item.expirationDate)}</TableCell>
            <TableCell>
              {item.daysUntilExpiration < 0 ? (
                <Badge variant="destructive">
                  Vencido há {Math.abs(item.daysUntilExpiration)} dias
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {item.daysUntilExpiration} dias restantes
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/employees/${item.employeeId}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Abrir ficha
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RegisterValidityDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: empData } = useQuery({
    queryKey: ['employees', 'all-for-validity'],
    queryFn: () => api.get('/employees?limit=500&status=ACTIVE') as any,
    enabled: open,
  });
  const employees: any[] = empData?.data?.data ?? empData?.data ?? [];

  const reset = () => {
    setEmployeeId('');
    setDocumentType('');
    setIssueDate('');
    setExpirationDate('');
    setNotes('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/employees/${employeeId}/validity`, {
        documentType,
        issueDate: issueDate || undefined,
        expirationDate: expirationDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Vencimento registrado');
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ['expiration-dashboard'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao registrar vencimento'),
  });

  const canSubmit = employeeId && documentType && expirationDate;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4 mr-2" />
        Registrar vencimento
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar vencimento de documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Funcionário</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando...</div>
                )}
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName}{e.matricula ? ` — ${e.matricula}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de documento</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de emissão (opcional)</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data de vencimento</Label>
              <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Input
              placeholder="Ex.: renovar com a clínica X"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            O sistema calcula o status automaticamente: vence em mais de 30 dias = válido,
            até 30 dias = atenção, até 7 dias = crítico, data passada = vencido.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Salvando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpirationDashboard() {
  const { canManageDocuments } = usePermissions();

  const { data, isLoading, error } = useQuery<{ data: Dashboard }>({
    queryKey: ['expiration-dashboard'],
    queryFn: () => api.get('/compliance/expiration-dashboard') as any,
    refetchInterval: 5 * 60 * 1000,
  });

  const dashboard = data?.data;
  const hasAny =
    (dashboard?.expired.length ?? 0) +
      (dashboard?.critical.length ?? 0) +
      (dashboard?.expiringSoon.length ?? 0) >
    0;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar dashboard de vencimentos</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ação + explicação de como alimentar a tela */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Alert className="sm:flex-1">
          <Info className="h-4 w-4" />
          <AlertTitle>Como aparecem os vencimentos aqui</AlertTitle>
          <AlertDescription>
            Os documentos com data de validade aparecem nesta tela automaticamente. Você pode
            informar a validade de três formas: ao anexar um documento na ficha do funcionário
            (aba <strong>Documentos</strong>), ao subir um arquivo no <strong>Dossiê</strong>, ou
            clicando em <strong>Registrar vencimento</strong> aqui mesmo.
          </AlertDescription>
        </Alert>
        {canManageDocuments && (
          <div className="shrink-0">
            <RegisterValidityDialog />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {dashboard?.expired.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">documentos vencidos</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crítico (≤ 7 dias)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dashboard?.critical.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">vencendo em breve</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atenção (≤ 30 dias)</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {dashboard?.expiringSoon.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">requerem atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários c/ Pendências</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.totalEmployeesWithPendencies ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">requerem ação</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado vazio explicativo */}
      {!hasAny && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum vencimento cadastrado ainda</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Assim que você registrar a validade de um documento (botão acima, ou ao anexar
              documentos na ficha do funcionário), os vencimentos passam a ser monitorados aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail tables */}
      {hasAny && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento de Vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="expired">
              <TabsList>
                <TabsTrigger value="expired" className="gap-2">
                  Vencidos
                  {(dashboard?.expired.length ?? 0) > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {dashboard!.expired.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="critical">
                  Crítico
                  {(dashboard?.critical.length ?? 0) > 0 && (
                    <Badge className="ml-1 bg-orange-500">
                      {dashboard!.critical.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="soon">Atenção</TabsTrigger>
              </TabsList>

              <TabsContent value="expired" className="mt-4">
                <ExpirationTable
                  items={dashboard?.expired ?? []}
                  emptyText="Nenhum documento vencido"
                />
              </TabsContent>

              <TabsContent value="critical" className="mt-4">
                <ExpirationTable
                  items={dashboard?.critical ?? []}
                  emptyText="Nenhum documento com vencimento crítico"
                />
              </TabsContent>

              <TabsContent value="soon" className="mt-4">
                <ExpirationTable
                  items={dashboard?.expiringSoon ?? []}
                  emptyText="Nenhum documento vencendo em 30 dias"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
