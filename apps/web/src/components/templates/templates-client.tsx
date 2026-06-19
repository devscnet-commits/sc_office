'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Variable } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Template {
  id: string;
  name: string;
  category: string | null;
  format: 'HTML' | 'DOCX';
  status: string;
  usageCount: number;
  variables?: string[];
}

const unwrapList = (resp: any): Template[] =>
  Array.isArray(resp?.data) ? resp.data : resp?.data?.data ?? [];

export function TemplatesClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState<'HTML' | 'DOCX'>('HTML');
  const [htmlContent, setHtmlContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates') as any,
  });
  const templates = unwrapList(data);

  const { data: varsData } = useQuery({
    queryKey: ['template-variables'],
    queryFn: () => api.get('/templates/variables') as any,
  });
  const variables: any[] = varsData?.data?.data ?? varsData?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['templates'] });

  const reset = () => { setName(''); setCategory(''); setFormat('HTML'); setHtmlContent(''); setFile(null); };

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('name', name);
      if (category) fd.append('category', category);
      fd.append('format', format);
      if (format === 'HTML') fd.append('htmlContent', htmlContent);
      if (format === 'DOCX' && file) fd.append('file', file);
      return api.post('/templates', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { toast.success('Template criado'); setOpen(false); reset(); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar template'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { toast.success('Template removido'); setDeleting(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const canSubmit = name.trim() && (format === 'HTML' ? htmlContent.trim() : !!file);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Modelos de documentos com variáveis.</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Template
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> {templates.length} template(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>}
                {!isLoading && templates.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum template cadastrado.</TableCell></TableRow>}
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.category || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{t.format}</Badge></TableCell>
                    <TableCell>{t.usageCount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">•••</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(t)}>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Variable className="h-4 w-4" /> Variáveis disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Use no conteúdo entre chaves duplas, ex.: <code className="text-foreground">{'{{funcionario.nome}}'}</code>
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto">
              {variables.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              {variables.map((v, i) => {
                const key = typeof v === 'string' ? v : v.key || v.name || v.variable;
                return <Badge key={i} variant="secondary" className="font-mono text-[10px]">{`{{${key}}}`}</Badge>;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato de Trabalho" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contratos" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTML">HTML (escrever aqui)</SelectItem>
                  <SelectItem value="DOCX">DOCX (enviar arquivo Word)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {format === 'HTML' ? (
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={'<h1>Declaração</h1>\n<p>Declaramos que {{funcionario.nome}}, matrícula {{funcionario.matricula}}...</p>'}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Arquivo .docx</Label>
                <Input type="file" accept=".docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">Use {'{{variavel}}'} dentro do documento Word.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Salvando...' : 'Criar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover template</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remover <span className="font-medium text-foreground">{deleting?.name}</span>?</p>
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
