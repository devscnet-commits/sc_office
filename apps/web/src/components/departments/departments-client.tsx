'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentId: string | null;
  active: boolean;
}

const schema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  code: z.string().min(2, 'Informe a sigla/código'),
  description: z.string().optional(),
  parentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const NONE = '__none__';

export function DepartmentsClient() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const { data, isLoading } = useQuery<{ data: Department[] }>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments') as any,
  });
  const departments = data?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['departments'] });
  const nameById = (id: string | null) => departments.find((d) => d.id === id)?.name ?? '—';

  const toBody = (d: FormData) => ({
    name: d.name,
    code: d.code,
    description: d.description || undefined,
    parentId: d.parentId && d.parentId !== NONE ? d.parentId : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (body: FormData) => api.post('/departments', toBody(body)),
    onSuccess: () => { toast.success('Departamento criado'); setCreateOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar departamento'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormData }) => api.put(`/departments/${id}`, toBody(body)),
    onSuccess: () => { toast.success('Departamento atualizado'); setEditing(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => { toast.success('Departamento removido'); setDeleting(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const openCreate = () => { form.reset({ name: '', code: '', description: '', parentId: NONE }); setCreateOpen(true); };
  const openEdit = (d: Department) => {
    setEditing(d);
    form.reset({ name: d.name, code: d.code, description: d.description || '', parentId: d.parentId || NONE });
  };

  const onSubmit = (d: FormData) => {
    if (editing) editMutation.mutate({ id: editing.id, body: d });
    else createMutation.mutate(d);
  };

  const dialogOpen = createOpen || !!editing;
  const closeDialog = () => { setCreateOpen(false); setEditing(null); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departamentos</h1>
          <p className="text-muted-foreground">Estrutura organizacional da empresa.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {departments.length} departamento(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Vínculo (superior)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && departments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum departamento cadastrado.</TableCell></TableRow>
              )}
              {departments.map((d) => (
                <TableRow key={d.id} className={!d.active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="outline">{d.code}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{nameById(d.parentId)}</TableCell>
                  <TableCell>
                    <Badge variant={d.active ? 'default' : 'secondary'}>{d.active ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">•••</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(d)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...form.register('name')} placeholder="Recursos Humanos" />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Código / Sigla</Label>
              <Input {...form.register('code')} placeholder="RH" />
              {form.formState.errors.code && <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input {...form.register('description')} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Departamento superior</Label>
              <Select value={form.watch('parentId') || NONE} onValueChange={(v) => form.setValue('parentId', v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum (raiz)</SelectItem>
                  {departments.filter((d) => d.id !== editing?.id).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || editMutation.isPending}>
                {createMutation.isPending || editMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover departamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover <span className="font-medium text-foreground">{deleting?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
