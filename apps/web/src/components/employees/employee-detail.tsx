'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, FileText, Folder, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { formatCPF, formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { HealthScoreBadge } from '../compliance/health-score-badge';
import { EmployeeDocuments } from './employee-documents';
import { DossierExplorer } from '../dossier/dossier-explorer';
import { usePermissions } from '../../stores/auth.store';

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: 'Ativo', variant: 'default' },
  INACTIVE: { label: 'Inativo', variant: 'secondary' },
  ON_LEAVE: { label: 'Afastado', variant: 'outline' },
  TERMINATED: { label: 'Desligado', variant: 'destructive' },
};

interface Props { employeeId: string }

export function EmployeeDetail({ employeeId }: Props) {
  const router = useRouter();
  const { canManageEmployees } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`) as any,
  });

  const emp = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!emp) return null;

  const initials = emp.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  const status = STATUS_LABELS[emp.status] || { label: emp.status, variant: 'outline' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{emp.fullName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Matrícula {emp.matricula}</span>
              <span>·</span>
              <span>{emp.position?.title}</span>
              <span>·</span>
              <span>{emp.department?.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HealthScoreBadge employeeId={employeeId} showScore />
          <Badge variant={status.variant}>{status.label}</Badge>
          {canManageEmployees && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/employees/${employeeId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          <Button size="sm" onClick={() => router.push(`/documents/generate?employeeId=${employeeId}`)}>
            <FileText className="h-4 w-4 mr-2" />
            Gerar Documento
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="info">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="documents">
            <ShieldCheck className="h-4 w-4 mr-1" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="dossier">
            <Folder className="h-4 w-4 mr-1" />
            Dossiê
          </TabsTrigger>
        </TabsList>

        {/* Dados Pessoais */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Nome completo" value={emp.fullName} />
                {emp.socialName && <Row label="Nome social" value={emp.socialName} />}
                <Row label="CPF" value={formatCPF(emp.cpf)} />
                <Row label="RG" value={emp.rg ? `${emp.rg} ${emp.rgIssuingBody || ''} ${emp.rgState || ''}`.trim() : '—'} />
                <Row label="Data de nascimento" value={formatDate(emp.birthDate)} />
                <Row label="Gênero" value={emp.gender} />
                <Row label="Estado civil" value={emp.maritalStatus} />
                <Row label="Naturalidade" value={`${emp.birthCity || ''}/${emp.birthState || ''}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Contato & Endereço</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Email" value={emp.email} />
                <Row label="Telefone" value={emp.phone || '—'} />
                <Row label="Celular" value={emp.cellphone || '—'} />
                <Row label="CEP" value={emp.zipCode || '—'} />
                <Row label="Endereço" value={emp.street ? `${emp.street}, ${emp.number}${emp.complement ? ` — ${emp.complement}` : ''}` : '—'} />
                <Row label="Bairro" value={emp.neighborhood || '—'} />
                <Row label="Cidade/UF" value={emp.city ? `${emp.city}/${emp.state}` : '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Dados Profissionais</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Matrícula" value={emp.matricula} />
                <Row label="Cargo" value={emp.position?.title || '—'} />
                <Row label="Departamento" value={emp.department?.name || '—'} />
                <Row label="Data de admissão" value={formatDate(emp.admissionDate)} />
                <Row label="Tipo de contrato" value={emp.contractType || '—'} />
                <Row label="Regime" value={emp.workRegime || '—'} />
                <Row label="PIS/PASEP" value={emp.pis || '—'} />
                <Row label="CTPS" value={emp.ctps ? `${emp.ctps}/${emp.ctpsSerie || ''}` : '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Contato de Emergência</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Contato" value={emp.emergencyContact || '—'} />
                <Row label="Telefone" value={emp.emergencyPhone || '—'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documents">
          <EmployeeDocuments employeeId={employeeId} />
        </TabsContent>

        {/* Dossiê */}
        <TabsContent value="dossier">
          <DossierExplorer employeeId={employeeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
