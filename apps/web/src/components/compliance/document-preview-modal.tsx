'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { ComplianceCheck } from './compliance-check';
import { ScrollArea } from '../ui/scroll-area';

interface PreviewResult {
  html: string;
  variables: Record<string, string>;
  compliance: {
    canGenerate: boolean;
    requirements: any[];
    blockerCount: number;
  };
}

interface Props {
  templateId: string;
  employeeId: string;
  open: boolean;
  onClose: () => void;
  onConfirmGenerate: (canGenerate: boolean) => void;
}

export function DocumentPreviewModal({
  templateId,
  employeeId,
  open,
  onClose,
  onConfirmGenerate,
}: Props) {
  const [activeTab, setActiveTab] = useState<'preview' | 'variables'>('preview');

  const { data, isPending, mutate } = useMutation<{ data: PreviewResult }, Error, void>({
    mutationFn: () =>
      api.post('/documents/preview', { templateId, employeeId }) as any,
  });

  const preview = data?.data;

  const handleOpen = () => {
    mutate();
  };

  // Trigger load when modal opens
  useState(() => {
    if (open && !preview && !isPending) {
      handleOpen();
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview do Documento
          </DialogTitle>
        </DialogHeader>

        {isPending && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Renderizando documento...</span>
          </div>
        )}

        {preview && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Compliance warning */}
            {!preview.compliance.canGenerate && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Geração bloqueada:</strong> {preview.compliance.blockerCount} documento(s)
                  obrigatório(s) ausente(s) ou vencido(s).
                </AlertDescription>
              </Alert>
            )}

            {/* Tab selector */}
            <div className="flex gap-2 border-b">
              <button
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('preview')}
              >
                <FileText className="inline h-4 w-4 mr-1" />
                Preview
              </button>
              <button
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'variables'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('variables')}
              >
                Variáveis
                <Badge className="ml-2" variant="secondary">
                  {Object.keys(preview.variables).length}
                </Badge>
              </button>
            </div>

            <ScrollArea className="flex-1">
              {activeTab === 'preview' ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert p-4 border rounded-md bg-white dark:bg-slate-950"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <div className="space-y-4">
                  <ComplianceCheck
                    templateId={templateId}
                    employeeId={employeeId}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Todas as variáveis substituídas:
                    </p>
                    {Object.entries(preview.variables).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start gap-3 text-sm p-2 rounded hover:bg-muted"
                      >
                        <code className="text-xs bg-muted px-1 rounded text-muted-foreground shrink-0">
                          {`{{${key}}}`}
                        </code>
                        <span className="text-foreground break-all">{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirmGenerate(preview?.compliance.canGenerate ?? false);
              onClose();
            }}
            disabled={isPending || !preview}
            className={!preview?.compliance.canGenerate ? 'opacity-50' : ''}
          >
            {preview?.compliance.canGenerate
              ? 'Confirmar e Gerar'
              : 'Gerar mesmo assim (override)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
