'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, FileText, FolderOpen, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { api } from '../../lib/api';

interface StatCard {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

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

  const stats: StatCard[] = [
    {
      title: 'Funcionários Ativos',
      value: employees?.data?.meta?.total ?? '—',
      description: 'Total de funcionários no sistema',
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Templates',
      value: templates?.data?.meta?.total ?? '—',
      description: 'Modelos de documentos disponíveis',
      icon: FileText,
      color: 'text-green-600',
    },
    {
      title: 'Documentos Gerados',
      value: documents?.data?.meta?.total ?? '—',
      description: 'Total de documentos gerados',
      icon: FolderOpen,
      color: 'text-purple-600',
    },
    {
      title: 'Este Mês',
      value: '—',
      description: 'Documentos gerados no mês atual',
      icon: TrendingUp,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
