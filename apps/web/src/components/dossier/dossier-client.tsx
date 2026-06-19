'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, FolderArchive } from 'lucide-react';
import { api } from '../../lib/api';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { DossierExplorer } from './dossier-explorer';
import { cn } from '../../lib/utils';

const unwrap = (resp: any): any[] =>
  Array.isArray(resp?.data) ? resp.data : resp?.data?.data ?? [];

export function DossierClient() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => api.get('/employees?limit=500') as any,
  });
  const employees = unwrap(data);
  const filtered = employees.filter(
    (e: any) =>
      e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      e.matricula?.includes(search),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dossiês</h1>
        <p className="text-muted-foreground">
          Documentos arquivados por funcionário — crie pastas e organize do jeito da empresa.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar funcionário..."
                className="pl-8"
              />
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {isLoading && <p className="text-sm text-muted-foreground px-3 py-2">Carregando...</p>}
              {!isLoading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">Nenhum funcionário.</p>
              )}
              {filtered.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => setSelected({ id: e.id, name: e.fullName })}
                  className={cn(
                    'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                    selected?.id === e.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                  )}
                >
                  <div className="font-medium">{e.fullName}</div>
                  <div className={cn('text-xs', selected?.id === e.id ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {e.matricula} · {e.department?.name || '—'}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div>
          {selected ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <DossierExplorer employeeId={selected.id} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
              <FolderArchive className="h-10 w-10 mb-3" />
              <p>Selecione um funcionário à esquerda para ver e organizar o dossiê.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
