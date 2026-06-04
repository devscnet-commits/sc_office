'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Folder, FolderOpen, File, Upload, Trash2, Download,
  Plus, ChevronRight, ChevronDown, ArrowLeft,
} from 'lucide-react';
import { api, uploadFile } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { usePermissions } from '../../stores/auth.store';

interface DossierFolder {
  id: string;
  name: string;
  isSystem: boolean;
  order: number;
  _count: { files: number; generatedDocuments: number };
  children: DossierFolder[];
}

interface DossierFile {
  id: string;
  name: string;
  mimeType: string;
  fileStorage: { size: number; originalName: string };
  createdAt: string;
}

interface Props { employeeId: string }

export function DossierExplorer({ employeeId }: Props) {
  const qc = useQueryClient();
  const { canManageEmployees } = usePermissions();
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [activeFolder, setActiveFolder] = useState<{ id: string; name: string } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string>('');

  const { data: treeData } = useQuery({
    queryKey: ['dossier-tree', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}/dossier`) as any,
  });
  const tree: DossierFolder[] = treeData?.data ?? [];

  const { data: contentsData } = useQuery({
    queryKey: ['dossier-contents', activeFolder?.id],
    queryFn: () => api.get(`/dossier/folders/${activeFolder!.id}/contents`) as any,
    enabled: !!activeFolder,
  });
  const contents = contentsData?.data ?? { files: [], generatedDocuments: [] };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dossier-tree', employeeId] });
    if (activeFolder) qc.invalidateQueries({ queryKey: ['dossier-contents', activeFolder.id] });
  };

  const createFolderMutation = useMutation({
    mutationFn: () => api.post(`/employees/${employeeId}/dossier/folders`, { name: newFolderName }),
    onSuccess: () => { toast.success('Pasta criada'); setNewFolderOpen(false); setNewFolderName(''); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadFile) throw new Error('Selecione um arquivo');
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('type', 'OUTRO');
      return uploadFile(`/dossier/folders/${uploadTargetId}/upload`, fd);
    },
    onSuccess: () => { toast.success('Arquivo enviado'); setUploadOpen(false); setUploadFile(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao enviar'),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/dossier/folders/${id}`),
    onSuccess: () => { toast.success('Pasta removida'); if (activeFolder) setActiveFolder(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Não é possível remover esta pasta'),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/dossier/files/${id}`),
    onSuccess: () => { toast.success('Arquivo removido'); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const toggleFolder = (id: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openUpload = (folderId: string) => {
    setUploadTargetId(folderId);
    setUploadOpen(true);
  };

  const renderFolder = (folder: DossierFolder, depth = 0) => {
    const isOpen = openFolders.has(folder.id);
    const isActive = activeFolder?.id === folder.id;
    const total = folder._count.files + folder._count.generatedDocuments;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors
            ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => { setActiveFolder({ id: folder.id, name: folder.name }); toggleFolder(folder.id); }}
        >
          {folder.children?.length > 0
            ? (isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />)
            : <span className="w-3" />}
          {isOpen ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate">{folder.name}</span>
          {total > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1">{total}</Badge>
          )}
        </div>
        {isOpen && folder.children?.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex gap-4 h-[500px]">
      {/* Sidebar tree */}
      <div className="w-64 border rounded-md flex flex-col shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Pastas</span>
          {canManageEmployees && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNewFolderOpen(true)}>
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
          {tree.map((folder) => renderFolder(folder))}
          {tree.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">Nenhuma pasta</p>
          )}
        </div>
      </div>

      {/* Contents panel */}
      <div className="flex-1 border rounded-md flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeFolder ? (
              <>
                <button onClick={() => setActiveFolder(null)} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium">{activeFolder.name}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Selecione uma pasta</span>
            )}
          </div>
          {activeFolder && canManageEmployees && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openUpload(activeFolder.id)}>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
              {!tree.find((f) => f.id === activeFolder.id)?.isSystem && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => { if (confirm('Remover pasta?')) deleteFolderMutation.mutate(activeFolder.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!activeFolder && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Folder className="h-10 w-10" />
              <p className="text-sm">Selecione uma pasta para ver os arquivos</p>
            </div>
          )}

          {activeFolder && (
            <div className="space-y-1">
              {contents.files.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{file.name || file.fileStorage?.originalName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(file.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/dossier/files/${file.id}/download`, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {canManageEmployees && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => { if (confirm('Remover arquivo?')) deleteFileMutation.mutate(file.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {contents.generatedDocuments.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="font-medium">{doc.name || `Documento ${doc.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-muted-foreground">Gerado em {formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/documents/${doc.id}/download`, '_blank')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {contents.files.length === 0 && contents.generatedDocuments.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
                    <File className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Pasta vazia</p>
                    {canManageEmployees && (
                      <Button size="sm" variant="outline" onClick={() => openUpload(activeFolder.id)}>
                        <Upload className="h-3 w-3 mr-1" />
                        Enviar arquivo
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Pasta</DialogTitle></DialogHeader>
          <Input
            placeholder="Nome da pasta"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createFolderMutation.mutate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
            <Button onClick={() => createFolderMutation.mutate()} disabled={!newFolderName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload de Arquivo</DialogTitle></DialogHeader>
          <div
            className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:border-primary"
            onClick={() => document.getElementById('dossier-upload-input')?.click()}
          >
            {uploadFile ? (
              <p className="text-sm font-medium">{uploadFile.name}</p>
            ) : (
              <div className="space-y-1">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo</p>
              </div>
            )}
          </div>
          <input
            id="dossier-upload-input"
            type="file"
            className="hidden"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={!uploadFile || uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
