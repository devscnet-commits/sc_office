'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users, FolderOpen, AlertCircle, Clock, AlertTriangle, ShieldAlert, LayoutTemplate,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

export function DashboardStats() {
  const { data: employees } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => api.get('/employees?limit=1') as any,
  });
  const { data: templates } = useQuery({
    queryKey: ['templates-count'],
    queryFn: () => api.get('/templates?limit=1') as any,
  });
  const { data: documents } = useQuery({
    queryKey: ['documents-count'],
    queryFn: () => api.get('/documents?limit=1') as any,
  });
  const { data: expirationData } = useQuery({
    queryKey: ['expiration-dashboard'],
    queryFn: () => api.get('/compliance/expiration-dashboard') as any,
    staleTime: 5 * 60 * 1000,
  });

  const exp = expirationData?.data;
  const hasAlerts = (exp?.expired?.length ?? 0) > 0 || (exp?.critical?.length ?? 0) > 0;

  const stats = [
    {
      title: 'Funcionários Ativos',
      value: employees?.data?.meta?.total ?? '—',
      description: 'Total no sistema',
      icon: Users,
      color: 'text-primary',
      href: '/employees',
      alert: false,
    },
    {
      title: 'Documentos Gerados',
      value: documents?.data?.meta?.total ?? '—',
      description: 'Total de documentos',
      icon: FolderOpen,
      color: 'text-purple-600',
      href: '/documents',
      alert: false,
    },
    {
      title: 'Templates Ativos',
      value: templates?.data?.meta?.total ?? '—',
      description: 'Modelos disponíveis',
      icon: LayoutTemplate,
      color: 'text-blue-600',
      href: '/templates',
      alert: false,
    },
    {
      title: 'c/ Pendências',
      value: exp?.totalEmployeesWithPendencies ?? '—',
      description: 'Funcionários pendentes',
      icon: ShieldAlert,
      color: 'text-orange-600',
      href: '/compliance',
      alert: (exp?.totalEmployeesWithPendencies ?? 0) > 0,
    },
    {
      title: 'Docs Vencidos',
      value: exp?.expired?.length ?? '—',
      description: 'Renovação imediata',
      icon: AlertCircle,
      color: 'text-destructive',
      href: '/compliance',
      alert: (exp?.expired?.length ?? 0) > 0,
    },
    {
      title: 'Vencimento Crítico',
      value: exp?.critical?.length ?? '—',
      description: 'Vencem em ≤7 dias',
      icon: AlertTriangle,
      color: 'text-orange-500',
      href: '/compliance',
      alert: (exp?.critical?.length ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {hasAlerts && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Atenção: existem documentos vencidos ou com vencimento crítico
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exp?.expired?.length ?? 0} vencido(s) · {exp?.critical?.length ?? 0} crítico(s)
            </p>
          </div>
          <Link href="/compliance">
            <Badge variant="destructive" className="cursor-pointer">Ver detalhes</Badge>
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow ${stat.alert ? 'border-destructive/40' : ''}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stat.alert ? 'text-destructive' : ''}`}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
