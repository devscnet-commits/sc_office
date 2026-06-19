'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, { message: 'As senhas não conferem', path: ['confirm'] });
type FormData = z.infer<typeof schema>;

export function ChangePasswordClient() {
  const router = useRouter();
  const { user, isAuthenticated, setUser } = useAuthStore();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  const mutation = useMutation({
    mutationFn: (d: FormData) =>
      api.post('/auth/change-password', { currentPassword: d.currentPassword, newPassword: d.newPassword }),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso');
      if (user) setUser({ ...user, mustChangePassword: false });
      router.replace('/dashboard');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao alterar senha'),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 mb-3">
            <span className="text-white font-black tracking-tight">SCNET</span>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Trocar senha
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Por segurança, defina uma nova senha para continuar.
          </p>
        </div>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input type="password" {...form.register('currentPassword')} />
            {form.formState.errors.currentPassword && (
              <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" {...form.register('newPassword')} />
            {form.formState.errors.newPassword && (
              <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input type="password" {...form.register('confirm')} />
            {form.formState.errors.confirm && (
              <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Alterar senha e continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
