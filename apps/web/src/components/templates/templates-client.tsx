'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Variable, Pencil, Download } from 'lucide-react';
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

interface Template {
  id: string;
  name: string;
  category: string | null;
  format: 'HTML' | 'DOCX';
  status: string;
  usageCount: number;
  htmlContent?: string | null;
  variables?: string[];
}

const unwrapList = (resp: any): Template[] =>
  Array.isArray(resp?.data) ? resp.data : resp?.data?.data ?? [];

const CATEGORIES = ['Contratos', 'Admissão', 'Demissão', 'Avisos', 'Atestados', 'Férias', 'Outros'];

export function TemplatesClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  // --- create form state ---
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState<'HTML' | 'DOCX'>('HTML');
  const [htmlContent, setHtmlContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // --- edit form state ---
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Pre-fill edit form when opening
  useEffect(() => {
    if (!editTarget) return;
    setEditName(editTarget.name);
    setEditCategory(editTarget.category || '');
    setEditHtml(editTarget.htmlContent || '');
    setEditFile(null);
    // Fetch full template data (htmlContent may not be in list response)
    api.get(`/templates/${editTarget.id}`).then((res: any) => {
      const t = res?.data ?? res;
      setEditHtml(t.htmlContent || '');
    }).catch(() => {});
  }, [editTarget]);

  const varPath = (v: any) =>
    typeof v === 'string' ? v.replace(/[{}]/g, '') : String(v.path ?? v.name ?? '').replace(/[{}]/g, '');

  const insertVariable = (v: any, textareaEl: HTMLTextAreaElement | null, content: string, setContent: (s: string) => void) => {
    const core = `{{${varPath(v)}}}`;
    if (!textareaEl) { setContent(content + (content && !/\s$/.test(content) ? ' ' : '') + core); return; }
    const start = textareaEl.selectionStart ?? content.length;
    const end = textareaEl.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const needLead = before.length > 0 && !/[\s>\n]$/.test(before);
    const needTrail = after.length > 0 && !/^[\s.,;:!?)<]/.test(after);
    const token = (needLead ? ' ' : '') + core + (needTrail ? ' ' : '');
    setContent(before + token + after);
    requestAnimationFrame(() => {
      textareaEl.focus();
      const pos = start + token.length;
      textareaEl.setSelectionRange(pos, pos);
    });
  };

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

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editTarget) return Promise.resolve();
      const fd = new FormData();
      fd.append('name', editName);
      if (editCategory) fd.append('category', editCategory);
      if (editTarget.format === 'HTML') fd.append('htmlContent', editHtml);
      if (editTarget.format === 'DOCX' && editFile) fd.append('file', editFile);
      return api.put(`/templates/${editTarget.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { toast.success('Template atualizado'); setEditTarget(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar template'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { toast.success('Template removido'); setDeleting(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const handleDownloadTemplate = async (t: Template) => {
    try {
      const blob: any = await api.get(`/templates/${t.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob?.data ?? blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t.name}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar template');
    }
  };

  const canSubmit = name.trim() && (format === 'HTML' ? htmlContent.trim() : !!file);
  const canUpdate = editName.trim() && (editTarget?.format === 'HTML' ? editHtml.trim() : true);

  const VarPicker = ({ textareaEl, content, setContent }: { textareaEl: HTMLTextAreaElement | null; content: string; setContent: (s: string) => void }) => (
    <div className="space-y-1">
      <Label className="flex items-center gap-1 text-xs"><Variable className="h-3 w-3" /> Inserir variável</Label>
      <p className="text-[10px] text-muted-foreground">Clique para inserir na posição do cursor.</p>
      <div className="flex flex-wrap gap-1 max-h-[260px] overflow-y-auto rounded-md border p-2">
        {variables.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        {variables.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => insertVariable(v, textareaEl, content, setContent)}
            className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {`{{${varPath(v)}}}`}
          </button>
        ))}
      </div>
    </div>
  );

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
                          <DropdownMenuItem onClick={() => setEditTarget(t)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {t.format === 'DOCX' && (
                            <DropdownMenuItem onClick={() => handleDownloadTemplate(t)}>
                              <Download className="h-4 w-4 mr-2" /> Baixar template
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
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
              Use no conteúdo entre chaves duplas, ex.: <code className="text-foreground">{'{'}{'{'}{'}'}funcionario.nome{'}'}{'}'}{'}'}</code>
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto">
              {variables.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              {variables.map((v, i) => {
                const path = typeof v === 'string'
                  ? v.replace(/[{}]/g, '')
                  : String(v.path ?? v.name ?? '').replace(/[{}]/g, '');
                return <Badge key={i} variant="secondary" className="font-mono text-[10px]">{`{{${path}}}`}</Badge>;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato de Trabalho" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
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
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
                <div className="space-y-2">
                  <Label>Conteúdo</Label>
                  <textarea
                    ref={textareaRef}
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    rows={14}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={'<h1>Declaração</h1>\n<p>Declaramos que {{funcionario.nome}}...</p>'}
                  />
                </div>
                <VarPicker textareaEl={textareaRef.current} content={htmlContent} setContent={setHtmlContent} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Arquivo .docx</Label>
                <Input type="file" accept=".docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">Use {'{{'}variável{'}}'}  dentro do documento Word.</p>
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

      {/* EDIT DIALOG */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Template — {editTarget?.format}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {editTarget?.format === 'HTML' ? (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
                <div className="space-y-2">
                  <Label>Conteúdo HTML</Label>
                  <textarea
                    ref={editTextareaRef}
                    value={editHtml}
                    onChange={(e) => setEditHtml(e.target.value)}
                    rows={16}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <VarPicker textareaEl={editTextareaRef.current} content={editHtml} setContent={setEditHtml} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Substituir arquivo .docx <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input type="file" accept=".docx" onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para manter o arquivo atual. Envie um novo .docx para substituir.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button disabled={!canUpdate || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover template</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remover <span className="font-medium text-foreground">{deleting?.name}</span>? Esta ação não pode ser desfeita.</p>
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
