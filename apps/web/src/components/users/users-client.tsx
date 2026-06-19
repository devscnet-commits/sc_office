'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, UserX, UserCheck, KeyRound, Pencil,
  ShieldCheck, Users, Eye, EyeOff, Check, Minus,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const ROLES = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'RH', label: 'RH' },
  { value: 'GESTOR', label: 'Gestor' },
  { value: 'CONSULTA', label: 'Consulta' },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  RH: 'bg-blue-100 text-blue-800',
  GESTOR: 'bg-purple-100 text-purple-800',
  CONSULTA: 'bg-gray-100 text-gray-800',
};

// Resumo do que cada papel pode fazer — reflete as permissões reais do sistema.
// (As permissões são definidas no código; esta tabela é uma referência para consulta.)
const PERMISSION_MATRIX: { area: string; admin: boolean; rh: boolean; gestor: boolean; consulta: boolean }[] = [
  { area: 'Visualizar dados (funcionários, templates, documentos, dossiês, compliance)', admin: true, rh: true, gestor: true, consulta: true },
  { area: 'Gerar documentos a partir de templates', admin: true, rh: true, gestor: true, consulta: true },
  { area: 'Cadastrar e editar funcionários', admin: true, rh: true, gestor: false, consulta: false },
  { area: 'Anexar, verificar e excluir documentos do funcionário', admin: true, rh: true, gestor: false, consulta: false },
  { area: 'Registrar validades e requisitos (Compliance)', admin: true, rh: true, gestor: false, consulta: false },
  { area: 'Criar, editar e excluir templates', admin: true, rh: true, gestor: false, consulta: false },
  { area: 'Criar e editar departamentos', admin: true, rh: true, gestor: false, consulta: false },
  { area: 'Excluir funcionários e departamentos', admin: true, rh: false, gestor: false, consulta: false },
  { area: 'Gerenciar usuários e papéis', admin: true, rh: false, gestor: false, consulta: false },
  { area: 'Ver logs de auditoria', admin: true, rh: false, gestor: false, consulta: false },
];

function PermCell({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="h-4 w-4 text-green-600 mx-auto" />
  ) : (
    <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

const createSchema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['ADMIN', 'RH', 'GESTOR', 'CONSULTA']),
});

const editSchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'RH', 'GESTOR', 'CONSULTA']).optional(),
});

const resetSchema = z.object({
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export function UsersClient() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { data, isLoading } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: () => api.get('/users') as any,
  });
  const users = data?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: (body: CreateForm) => api.post('/users', body),
    onSuccess: () => { toast.success('Usuário criado com sucesso'); setCreateOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar usuário'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: EditForm }) => api.patch(`/users/${id}`, body),
    onSuccess: () => { toast.success('Usuário atualizado'); setEditUser(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResetForm }) =>
      api.post(`/users/${id}/reset-password`, body),
    onSuccess: () => { toast.success('Senha redefinida'); setResetUser(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao redefinir senha'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' }) =>
      action === 'activate' ? api.patch(`/users/${id}/activate`, {}) : api.delete(`/users/${id}/deactivate`),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'activate' ? 'Usuário reativado' : 'Usuário desativado');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const openEdit = (user: User) => {
    setEditUser(user);
    editForm.reset({ name: user.name, email: user.email, role: user.role as any });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os acessos ao sistema.</p>
        </div>
        <Button onClick={() => { createForm.reset(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        {ROLES.map((r) => (
          <Card key={r.value}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{r.label}</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter((u) => u.role === r.value).length}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Papéis e Permissões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            O que cada papel pode fazer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ao criar um usuário, escolha o papel conforme o que ele precisa fazer. As permissões
            abaixo são fixas (definidas no sistema) — esta tabela serve de referência.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Permissão</TableHead>
                  <TableHead className="text-center">Administrador</TableHead>
                  <TableHead className="text-center">RH</TableHead>
                  <TableHead className="text-center">Gestor</TableHead>
                  <TableHead className="text-center">Consulta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSION_MATRIX.map((row) => (
                  <TableRow key={row.area}>
                    <TableCell className="text-sm">{row.area}</TableCell>
                    <TableCell><PermCell allowed={row.admin} /></TableCell>
                    <TableCell><PermCell allowed={row.rh} /></TableCell>
                    <TableCell><PermCell allowed={row.gestor} /></TableCell>
                    <TableCell><PermCell allowed={row.consulta} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p><span className="font-medium text-foreground">Administrador:</span> acesso total, incluindo usuários e auditoria.</p>
            <p><span className="font-medium text-foreground">RH:</span> opera o dia a dia (funcionários, documentos, templates, compliance), mas não gerencia usuários.</p>
            <p><span className="font-medium text-foreground">Gestor e Consulta:</span> hoje têm o mesmo acesso — apenas visualizar e gerar documentos. Se quiser dar mais poderes ao Gestor (ex.: editar funcionários da equipe), me avise que eu ajusto.</p>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {users.length} usuário(s) cadastrado(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => (
                <TableRow key={user.id} className={user.status === 'INACTIVE' ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.mustChangePassword && (
                      <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-300">
                        Troca senha
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[user.role]}>
                      {ROLES.find((r) => r.value === user.role)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">•••</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { resetForm.reset(); setResetUser(user); }}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Redefinir senha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === 'ACTIVE' ? (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => statusMutation.mutate({ id: user.id, action: 'deactivate' })}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => statusMutation.mutate({ id: user.id, action: 'activate' })}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Reativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input {...createForm.register('name')} placeholder="Maria Silva" />
              {createForm.formState.errors.name && (
                <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...createForm.register('email')} type="email" placeholder="maria@scnet.com.br" />
              {createForm.formState.errors.email && (
                <p className="text-xs text-destructive">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Senha inicial</Label>
              <div className="relative">
                <Input
                  {...createForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {createForm.formState.errors.password && (
                <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                O usuário deverá trocar a senha no primeiro acesso.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Select onValueChange={(v) => createForm.setValue('role', v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.formState.errors.role && (
                <p className="text-xs text-destructive">{createForm.formState.errors.role.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((d) => editMutation.mutate({ id: editUser!.id, body: d }))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...editForm.register('email')} type="email" />
              {editForm.formState.errors.email && (
                <p className="text-xs text-destructive">{editForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Select
                defaultValue={editUser?.role}
                onValueChange={(v) => editForm.setValue('role', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha — {resetUser?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={resetForm.handleSubmit((d) => resetMutation.mutate({ id: resetUser!.id, body: d }))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  {...resetForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {resetForm.formState.errors.password && (
                <p className="text-xs text-destructive">{resetForm.formState.errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                O usuário precisará trocar a senha no próximo acesso.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setResetUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
