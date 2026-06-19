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
  // Pessoais
  fullName: z.string().min(3, 'Nome obrigatório'),
  socialName: z.string().optional(),
  cpf: z.string().min(11, 'CPF inválido').max(14),
  rg: z.string().optional(),
  rgIssuingBody: z.string().optional(),
  rgState: z.string().optional(),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  race: z.string().optional(),
  educationLevel: z.string().optional(),
  bloodType: z.string().optional(),
  children: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cellphone: z.string().optional(),
  // Documentos
  pis: z.string().optional(),
  ctps: z.string().optional(),
  ctpsSerie: z.string().optional(),
  ctpsState: z.string().optional(),
  // Profissional
  admissionDate: z.string().min(1, 'Data de admissão obrigatória'),
  departmentId: z.string().min(1, 'Departamento obrigatório'),
  positionId: z.string().min(1, 'Cargo obrigatório'),
  contractType: z.string().optional(),
  workRegime: z.string().optional(),
  salary: z.string().optional(),
  observations: z.string().optional(),
  // Endereço
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  // Bancários
  bankName: z.string().optional(),
  bankAgency: z.string().optional(),
  bankAccount: z.string().optional(),
  bankPix: z.string().optional(),
  // Uniforme
  uniformShirt: z.string().optional(),
  uniformTShirt: z.string().optional(),
  uniformPants: z.string().optional(),
  uniformJacket: z.string().optional(),
  uniformCoat: z.string().optional(),
  bootSize: z.string().optional(),
  // Emergência
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const GENDERS = [
  { v: 'MASCULINO', l: 'Masculino' }, { v: 'FEMININO', l: 'Feminino' },
  { v: 'OUTRO', l: 'Outro' }, { v: 'NAO_INFORMADO', l: 'Não informado' },
];
const MARITAL = [
  { v: 'SOLTEIRO', l: 'Solteiro(a)' }, { v: 'CASADO', l: 'Casado(a)' },
  { v: 'DIVORCIADO', l: 'Divorciado(a)' }, { v: 'VIUVO', l: 'Viúvo(a)' },
  { v: 'UNIAO_ESTAVEL', l: 'União estável' }, { v: 'OUTRO', l: 'Outro' },
];
const EDUCATION = ['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação'];
const RACES = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não informado'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ALL_TEXT_FIELDS: (keyof FormData)[] = [
  'fullName', 'socialName', 'cpf', 'rg', 'rgIssuingBody', 'rgState', 'gender',
  'maritalStatus', 'nationality', 'race', 'educationLevel', 'bloodType', 'children',
  'email', 'phone', 'cellphone', 'pis', 'ctps', 'ctpsSerie', 'ctpsState',
  'departmentId', 'positionId', 'contractType', 'workRegime', 'observations',
  'zipCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state',
  'bankName', 'bankAgency', 'bankAccount', 'bankPix', 'uniformShirt', 'uniformTShirt',
  'uniformPants', 'uniformJacket', 'uniformCoat', 'bootSize', 'emergencyContact', 'emergencyPhone',
];

interface Props { employeeId?: string }

export function EmployeeForm({ employeeId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!employeeId;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { data: depts } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments') as any });
  const { data: positions } = useQuery({ queryKey: ['positions'], queryFn: () => api.get('/positions') as any });
  const { data: empData } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`) as any,
    enabled: isEdit,
  });

  useEffect(() => {
    const emp = empData?.data;
    if (!emp) return;
    ALL_TEXT_FIELDS.forEach((f) => emp[f] != null && setValue(f, String(emp[f])));
    if (emp.birthDate) setValue('birthDate', emp.birthDate.slice(0, 10));
    if (emp.admissionDate) setValue('admissionDate', emp.admissionDate.slice(0, 10));
    if (emp.salary != null) setValue('salary', String(emp.salary));
  }, [empData, setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, salary: data.salary ? parseFloat(data.salary) : undefined };
      return isEdit ? api.put(`/employees/${employeeId}`, payload) : api.post('/employees', payload);
    },
    onSuccess: (res: any) => {
      toast.success(isEdit ? 'Funcionário atualizado' : 'Funcionário cadastrado');
      qc.invalidateQueries({ queryKey: ['employees'] });
      const id = isEdit ? employeeId : res?.data?.id;
      router.push(id ? `/employees/${id}` : '/employees');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const departments = depts?.data?.data ?? depts?.data ?? [];
  const positionsList = positions?.data?.data ?? positions?.data ?? [];

  const Pick = ({ field, placeholder, options }: { field: keyof FormData; placeholder: string; options: { v: string; l: string }[] }) => (
    <Select value={(watch(field) as string) || ''} onValueChange={(v) => setValue(field, v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}</h1>
          <p className="text-muted-foreground text-sm">Preencha os dados do funcionário</p>
        </div>
      </div>

      {/* Dados Pessoais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nome completo *" error={errors.fullName?.message}><Input {...register('fullName')} placeholder="João da Silva" /></Field>
          <Field label="Nome social"><Input {...register('socialName')} /></Field>
          <Field label="CPF *" error={errors.cpf?.message}><Input {...register('cpf')} placeholder="000.000.000-00" /></Field>
          <Field label="RG"><Input {...register('rg')} placeholder="0000000" /></Field>
          <Field label="Órgão emissor (RG)"><Input {...register('rgIssuingBody')} placeholder="SSP" /></Field>
          <Field label="UF (RG)"><Input {...register('rgState')} placeholder="SC" maxLength={2} /></Field>
          <Field label="Data de nascimento *" error={errors.birthDate?.message}><Input type="date" {...register('birthDate')} /></Field>
          <Field label="Sexo"><Pick field="gender" placeholder="Selecione" options={GENDERS} /></Field>
          <Field label="Estado civil"><Pick field="maritalStatus" placeholder="Selecione" options={MARITAL} /></Field>
          <Field label="Nacionalidade"><Input {...register('nationality')} placeholder="Brasileiro(a)" /></Field>
          <Field label="Raça/Cor"><Pick field="race" placeholder="Selecione" options={RACES.map((r) => ({ v: r, l: r }))} /></Field>
          <Field label="Grau de instrução"><Pick field="educationLevel" placeholder="Selecione" options={EDUCATION.map((e) => ({ v: e, l: e }))} /></Field>
          <Field label="Tipo sanguíneo"><Pick field="bloodType" placeholder="Selecione" options={BLOOD.map((b) => ({ v: b, l: b }))} /></Field>
          <Field label="Filhos (nome/idade)"><Input {...register('children')} placeholder="Ex.: Ana (8), Pedro (5)" /></Field>
          <Field label="E-mail"><Input type="email" {...register('email')} placeholder="joao@empresa.com" /></Field>
          <Field label="Celular / Telefone 01"><Input {...register('cellphone')} placeholder="(00) 00000-0000" /></Field>
          <Field label="Telefone 02"><Input {...register('phone')} placeholder="(00) 0000-0000" /></Field>
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Documentos (CTPS / PIS)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="PIS / NIS"><Input {...register('pis')} /></Field>
          <Field label="CTPS (número)"><Input {...register('ctps')} /></Field>
          <Field label="CTPS série"><Input {...register('ctpsSerie')} /></Field>
          <Field label="CTPS UF"><Input {...register('ctpsState')} maxLength={2} placeholder="SC" /></Field>
        </CardContent>
      </Card>

      {/* Profissional */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Profissionais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Data de admissão *" error={errors.admissionDate?.message}><Input type="date" {...register('admissionDate')} /></Field>
          <Field label="Departamento *" error={errors.departmentId?.message}>
            <Select value={watch('departmentId') || ''} onValueChange={(v) => setValue('departmentId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Cargo *" error={errors.positionId?.message}>
            <Select value={watch('positionId') || ''} onValueChange={(v) => setValue('positionId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{positionsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Salário"><Input type="number" step="0.01" {...register('salary')} placeholder="0,00" /></Field>
          <Field label="Observações"><Input {...register('observations')} /></Field>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="CEP"><Input {...register('zipCode')} placeholder="00000-000" /></Field>
          <Field label="Logradouro"><Input {...register('street')} placeholder="Rua das Flores" /></Field>
          <Field label="Número"><Input {...register('number')} placeholder="123" /></Field>
          <Field label="Complemento"><Input {...register('complement')} placeholder="Apto, bloco..." /></Field>
          <Field label="Bairro"><Input {...register('neighborhood')} placeholder="Centro" /></Field>
          <Field label="Cidade"><Input {...register('city')} placeholder="Joinville" /></Field>
          <Field label="Estado"><Input {...register('state')} placeholder="SC" maxLength={2} /></Field>
        </CardContent>
      </Card>

      {/* Bancários */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Bancários</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Banco"><Input {...register('bankName')} placeholder="Sicoob" /></Field>
          <Field label="Agência"><Input {...register('bankAgency')} /></Field>
          <Field label="Conta"><Input {...register('bankAccount')} placeholder="Corrente / Poupança" /></Field>
          <Field label="Chave PIX"><Input {...register('bankPix')} /></Field>
        </CardContent>
      </Card>

      {/* Uniforme */}
      <Card>
        <CardHeader><CardTitle className="text-base">Uniforme</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Camisa"><Input {...register('uniformShirt')} placeholder="P / M / G / GG" /></Field>
          <Field label="Camiseta"><Input {...register('uniformTShirt')} placeholder="P / M / G / GG" /></Field>
          <Field label="Calça"><Input {...register('uniformPants')} placeholder="P / M / G / GG" /></Field>
          <Field label="Jaqueta"><Input {...register('uniformJacket')} placeholder="P / M / G / GG" /></Field>
          <Field label="Casaco"><Input {...register('uniformCoat')} placeholder="P / M / G / GG" /></Field>
          <Field label="Botina (nº)"><Input {...register('bootSize')} placeholder="42" /></Field>
        </CardContent>
      </Card>

      {/* Emergência */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contato de Emergência</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nome"><Input {...register('emergencyContact')} placeholder="Maria Silva" /></Field>
          <Field label="Telefone"><Input {...register('emergencyPhone')} placeholder="(00) 00000-0000" /></Field>
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
