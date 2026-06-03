'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Clock, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Alert, AlertDescription } from '../ui/alert';

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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ExpirationDashboard() {
  const { data, isLoading, error } = useQuery<{ data: Dashboard }>({
    queryKey: ['expiration-dashboard'],
    queryFn: () => api.get('/compliance/expiration-dashboard') as any,
    refetchInterval: 5 * 60 * 1000,
  });

  const dashboard = data?.data;

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

      {/* Detail tables */}
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
    </div>
  );
}
