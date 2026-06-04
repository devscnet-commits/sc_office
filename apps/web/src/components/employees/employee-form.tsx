'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const schema = z.object({
  fullName: z.string().min(3, 'Nome obrigatório'),
  cpf: z.string().min(11, 'CPF inválido').max(14),
  rg: z.string().optional(),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cellphone: z.string().optional(),
  admissionDate: z.string().min(1, 'Data de admissão obrigatória'),
  departmentId: z.string().min(1, 'Departamento obrigatório'),
  positionId: z.string().min(1, 'Cargo obrigatório'),
  contractType: z.string().optional(),
  workRegime: z.string().optional(),
  salary: z.string().optional(),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props { employeeId?: string }

export function EmployeeForm({ employeeId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!employeeId;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments') as any,
  });
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.get('/positions') as any,
  });
  const { data: empData } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`) as any,
    enabled: isEdit,
  });

  useEffect(() => {
    const emp = empData?.data;
    if (!emp) return;
    const fields: (keyof FormData)[] = [
      'fullName', 'cpf', 'rg', 'email', 'phone', 'cellphone',
      'admissionDate', 'departmentId', 'positionId', 'contractType',
      'workRegime', 'zipCode', 'street', 'number', 'neighborhood',
      'city', 'state', 'emergencyContact', 'emergencyPhone',
    ];
    fields.forEach((f) => emp[f] && setValue(f, emp[f]));
    if (emp.birthDate) setValue('birthDate', emp.birthDate.slice(0, 10));
    if (emp.admissionDate) setValue('admissionDate', emp.admissionDate.slice(0, 10));
    if (emp.salary) setValue('salary', String(emp.salary));
  }, [empData, setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, salary: data.salary ? parseFloat(data.salary) : undefined };
      return isEdit
        ? api.put(`/employees/${employeeId}`, payload)
        : api.post('/employees', payload);
    },
    onSuccess: (res: any) => {
      toast.success(isEdit ? 'Funcionário atualizado' : 'Funcionário cadastrado');
      qc.invalidateQueries({ queryKey: ['employees'] });
      const id = isEdit ? employeeId : res?.data?.id;
      router.push(id ? `/dashboard/employees/${id}` : '/dashboard/employees');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const departments = depts?.data?.data ?? depts?.data ?? [];
  const positionsList = positions?.data?.data ?? positions?.data ?? [];

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}</h1>
          <p className="text-muted-foreground text-sm">Preencha os dados do funcionário</p>
        </div>
      </div>

      {/* Dados Pessoais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nome completo *" error={errors.fullName?.message}>
            <Input {...register('fullName')} placeholder="João da Silva" />
          </Field>
          <Field label="CPF *" error={errors.cpf?.message}>
            <Input {...register('cpf')} placeholder="000.000.000-00" />
          </Field>
          <Field label="RG" error={errors.rg?.message}>
            <Input {...register('rg')} placeholder="0000000" />
          </Field>
          <Field label="Data de nascimento *" error={errors.birthDate?.message}>
            <Input type="date" {...register('birthDate')} />
          </Field>
          <Field label="Email">
            <Input type="email" {...register('email')} placeholder="joao@empresa.com" />
          </Field>
          <Field label="Celular">
            <Input {...register('cellphone')} placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Telefone">
            <Input {...register('phone')} placeholder="(00) 0000-0000" />
          </Field>
        </CardContent>
      </Card>

      {/* Dados Profissionais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Profissionais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Data de admissão *" error={errors.admissionDate?.message}>
            <Input type="date" {...register('admissionDate')} />
          </Field>
          <Field label="Departamento *" error={errors.departmentId?.message}>
            <Select defaultValue={watch('departmentId')} onValueChange={(v) => setValue('departmentId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cargo *" error={errors.positionId?.message}>
            <Select defaultValue={watch('positionId')} onValueChange={(v) => setValue('positionId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {positionsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de contrato">
            <Select onValueChange={(v) => setValue('contractType', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="PJ">PJ</SelectItem>
                <SelectItem value="ESTAGIO">Estágio</SelectItem>
                <SelectItem value="TEMPORARIO">Temporário</SelectItem>
                <SelectItem value="APRENDIZ">Aprendiz</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Salário">
            <Input type="number" step="0.01" {...register('salary')} placeholder="0,00" />
          </Field>
          <Field label="Regime de trabalho">
            <Select onValueChange={(v) => setValue('workRegime', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                <SelectItem value="HIBRIDO">Híbrido</SelectItem>
                <SelectItem value="REMOTO">Remoto</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="CEP">
            <Input {...register('zipCode')} placeholder="00000-000" />
          </Field>
          <Field label="Logradouro">
            <Input {...register('street')} placeholder="Rua das Flores" />
          </Field>
          <Field label="Número">
            <Input {...register('number')} placeholder="123" />
          </Field>
          <Field label="Bairro">
            <Input {...register('neighborhood')} placeholder="Centro" />
          </Field>
          <Field label="Cidade">
            <Input {...register('city')} placeholder="Joinville" />
          </Field>
          <Field label="Estado">
            <Input {...register('state')} placeholder="SC" maxLength={2} />
          </Field>
        </CardContent>
      </Card>

      {/* Emergência */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contato de Emergência</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nome">
            <Input {...register('emergencyContact')} placeholder="Maria Silva" />
          </Field>
          <Field label="Telefone">
            <Input {...register('emergencyPhone')} placeholder="(00) 00000-0000" />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? 'Salvar alterações' : 'Cadastrar funcionário'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
