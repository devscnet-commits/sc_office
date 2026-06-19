'use client';

import { useTheme } from 'next-themes';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sun, Moon, Monitor, KeyRound, User } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', RH: 'RH', GESTOR: 'Gestor', CONSULTA: 'Consulta',
};

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'As senhas não conferem',
    path: ['confirm'],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const THEMES = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function SettingsClient() {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const changePassword = useMutation({
    mutationFn: (d: PasswordForm) =>
      api.post('/auth/change-password', { currentPassword: d.currentPassword, newPassword: d.newPassword }),
    onSuccess: () => { toast.success('Senha alterada com sucesso'); form.reset(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao alterar senha'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Preferências da sua conta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{user?.name ?? '—'}</span></p>
          <p><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{user?.email ?? '—'}</span></p>
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Perfil:</span>
            <Badge>{ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—'}</Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.value}
                  type="button"
                  variant={theme === t.value ? 'default' : 'outline'}
                  onClick={() => setTheme(t.value)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((d) => changePassword.mutate(d))} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>Senha atual</Label>
              <Input type="password" {...form.register('currentPassword')} />
              {form.formState.errors.currentPassword && <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" {...form.register('newPassword')} />
              {form.formState.errors.newPassword && <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" {...form.register('confirm')} />
              {form.formState.errors.confirm && <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>}
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
