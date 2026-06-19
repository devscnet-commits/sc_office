'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface AuditLog {
  id: string;
  createdAt: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  success: boolean;
  user: { id: string; name: string; email: string } | null;
}

export function AuditClient() {
  const { data, isLoading } = useQuery<{ data: { data: AuditLog[] } }>({
    queryKey: ['audit'],
    queryFn: () => api.get('/audit?limit=100') as any,
  });
  const logs = data?.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground">Registro de ações realizadas no sistema.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            {logs.length} registro(s) recente(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && logs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro de auditoria ainda.</TableCell></TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-sm">{log.user?.name ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline">{log.module}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{log.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {log.description || `${log.entityType}${log.entityId ? ` (${log.entityId})` : ''}`}
                  </TableCell>
                  <TableCell>
                    {log.success
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-destructive" />}
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
