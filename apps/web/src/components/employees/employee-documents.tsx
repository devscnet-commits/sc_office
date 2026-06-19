'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Upload, Download, Trash2, CheckCircle2, Clock, AlertTriangle,
  XCircle, FileText, Plus, ShieldCheck,
} from 'lucide-react';
import { api, uploadFile } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { usePermissions } from '../../stores/auth.store';

const DOC_TYPES = [
  { value: 'RG', label: 'RG' },
  { value: 'CPF', label: 'CPF' },
  { value: 'CTPS', label: 'CTPS' },
  { value: 'CNH', label: 'CNH' },
  { value: 'ASO', label: 'ASO (Atestado de Saúde)' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'COMPROVANTE_ENDERECO', label: 'Comprovante de Endereço' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'RESERVISTA', label: 'Reservista' },
  { value: 'TITULO_ELEITOR', label: 'Título de Eleitor' },
  { value: 'FOTO_3X4', label: 'Foto 3x4' },
  { value: 'OUTRO', label: 'Outro' },
];

const VALIDITY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  VALID: { icon: CheckCircle2, color: 'text-green-600', label: 'Válido' },
  EXPIRING_SOON: { icon: Clock, color: 'text-yellow-600', label: 'Vencendo' },
  CRITICAL: { icon: AlertTriangle, color: 'text-orange-600', label: 'Crítico' },
  EXPIRED: { icon: XCircle, color: 'text-destructive', label: 'Vencido' },
  NOT_APPLICABLE: { icon: CheckCircle2, color: 'text-muted-foreground', label: 'S/validade' },
};

interface Props { employeeId: string }

export function EmployeeDocuments({ employeeId }: Props) {
  const qc = useQueryClient();
  const { canManageEmployees, canManageDocuments } = usePermissions();
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ type: '', name: '', issuedAt: '', expiresAt: '', description: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}/documents`) as any,
  });
  const docs = data?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['employee-documents', employeeId] });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('Selecione um arquivo');
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('type', form.type);
      fd.append('name', form.name || selectedFile.name);
      if (form.issuedAt) fd.append('issuedAt', form.issuedAt);
      if (form.expiresAt) fd.append('expiresAt', form.expiresAt);
      if (form.description) fd.append('description', form.description);
      return uploadFile(`/employees/${employeeId}/documents`, fd);
    },
    onSuccess: () => {
      toast.success('Documento enviado com sucesso');
      setUploadOpen(false);
      setSelectedFile(null);
      setForm({ type: '', name: '', issuedAt: '', expiresAt: '', description: '' });
      invalidate();
      qc.invalidateQueries({ queryKey: ['health-score', employeeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao enviar documento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/employees/${employeeId}/documents/${docId}`),
    onSuccess: () => { toast.success('Documento removido'); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });

  const verifyMutation = useMutation({
    mutationFn: (docId: string) => api.patch(`/employees/${employeeId}/documents/${docId}/verify`, {}),
    onSuccess: () => { toast.success('Documento verificado'); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const download = (docId: string, filename: string) => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/employees/${employeeId}/documents/${docId}/download`, '_blank');
  };

  // Group by type
  const grouped = DOC_TYPES.reduce((acc, t) => {
    const items = docs.filter((d: any) => d.type === t.value);
    if (items.length > 0) acc[t.value] = { label: t.label, items };
    return acc;
  }, {} as Record<string, { label: string; items: any[] }>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{docs.length} documento(s) cadastrado(s)</p>
        {canManageDocuments && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Documento
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      {docs.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum documento cadastrado</p>
            {canManageDocuments && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro documento
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([type, { label, items }]) => (
        <Card key={type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((doc: any) => {
              const validity = doc.documentValidity?.[0];
              const vConfig = validity ? VALIDITY_CONFIG[validity.status] : null;
              const VIcon = vConfig?.icon;

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{doc.fileStorage?.originalName}</span>
                        {validity?.expirationDate && (
                          <>
                            <span>·</span>
                            <span>Vence: {formatDate(validity.expirationDate)}</span>
                          </>
                        )}
                        {validity?.issueDate && (
                          <>
                            <span>·</span>
                            <span>Emitido: {formatDate(validity.issueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {vConfig && VIcon && (
                      <div className={`flex items-center gap-1 text-xs ${vConfig.color}`}>
                        <VIcon className="h-3 w-3" />
                        {vConfig.label}
                      </div>
                    )}
                    {doc.verified ? (
                      <Badge className="text-xs bg-green-100 text-green-800">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Verificado
                      </Badge>
                    ) : canManageDocuments ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => verifyMutation.mutate(doc.id)}
                      >
                        Verificar
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        Pendente
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(doc.id, doc.fileStorage?.originalName)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    {canManageEmployees && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Remover documento?')) deleteMutation.mutate(doc.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo</Label>
              <div
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {selectedFile ? (
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar</p>
                    <p className="text-xs text-muted-foreground">PDF, imagem ou Word — máx. 20MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome / descrição (opcional)</Label>
              <Input
                placeholder="Ex: RG atualizado 2025"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de emissão</Label>
                <Input
                  type="date"
                  value={form.issuedAt}
                  onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de validade</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || !form.type || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Enviando...' : 'Enviar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
