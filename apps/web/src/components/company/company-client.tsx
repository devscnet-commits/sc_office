'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Building2, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Company {
  id?: string;
  name?: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  website?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

const EMPTY: Company = {
  name: '', tradeName: '', cnpj: '', email: '', phone: '', website: '',
  zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
};

export function CompanyClient() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Company }>({
    queryKey: ['company'],
    queryFn: () => api.get('/company') as any,
  });

  const company = data?.data ?? undefined;

  const { register, handleSubmit } = useForm<Company>({
    values: { ...EMPTY, ...(company || {}) },
  });

  const saveMutation = useMutation({
    mutationFn: (body: Company) => api.put('/company', body),
    onSuccess: () => { toast.success('Dados da empresa salvos'); qc.invalidateQueries({ queryKey: ['company'] }); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  const field = (name: keyof Company, label: string, placeholder = '', type = 'text') => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} placeholder={placeholder} {...register(name)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empresa</h1>
        <p className="text-muted-foreground">Dados usados nos documentos gerados.</p>
      </div>

      <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Dados da empresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field('name', 'Razão social', 'SC Office Ltda')}
            {field('tradeName', 'Nome fantasia', 'SC Office')}
            {field('cnpj', 'CNPJ', '00.000.000/0000-00')}
            {field('email', 'E-mail', 'contato@empresa.com', 'email')}
            {field('phone', 'Telefone', '(00) 0000-0000')}
            {field('website', 'Site', 'https://...')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field('zipCode', 'CEP', '00000-000')}
            {field('street', 'Logradouro', 'Rua / Avenida')}
            {field('number', 'Número', '123')}
            {field('complement', 'Complemento', 'Sala, andar...')}
            {field('neighborhood', 'Bairro')}
            {field('city', 'Cidade')}
            {field('state', 'UF', 'SP')}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
