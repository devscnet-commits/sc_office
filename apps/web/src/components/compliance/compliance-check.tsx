'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';

interface RequirementStatus {
  documentType: string;
  label: string;
  required: boolean;
  blockGeneration: boolean;
  status: 'OK' | 'MISSING' | 'EXPIRED';
  expiresAt?: string;
}

interface ComplianceResult {
  canGenerate: boolean;
  requirements: RequirementStatus[];
  missingCount: number;
  blockerCount: number;
}

interface Props {
  templateId: string;
  employeeId: string;
  onComplianceChange?: (canGenerate: boolean) => void;
}

const STATUS_CONFIG = {
  OK: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950',
    label: 'Presente',
  },
  MISSING: {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-red-50 dark:bg-red-950',
    label: 'Ausente',
  },
  EXPIRED: {
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950',
    label: 'Vencido',
  },
};

export function ComplianceCheck({ templateId, employeeId, onComplianceChange }: Props) {
  const { data, isLoading } = useQuery<{ data: ComplianceResult }>({
    queryKey: ['compliance-check', templateId, employeeId],
    queryFn: () =>
      api.get(`/compliance/check?templateId=${templateId}&employeeId=${employeeId}`) as any,
    enabled: !!templateId && !!employeeId,
    onSuccess: (data) => {
      onComplianceChange?.(data?.data?.canGenerate ?? false);
    },
  } as any);

  const compliance = data?.data;

  if (!templateId || !employeeId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!compliance) return null;

  // No requirements configured for this template
  if (compliance.requirements.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-700">Sem requisitos</AlertTitle>
        <AlertDescription className="text-green-600">
          Este template não requer documentos específicos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={compliance.canGenerate ? '' : 'border-destructive/50'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Verificação de Documentos Obrigatórios
          </CardTitle>
          {compliance.canGenerate ? (
            <Badge className="bg-green-600">Aprovado</Badge>
          ) : (
            <Badge variant="destructive">
              {compliance.blockerCount} bloqueio(s)
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {!compliance.canGenerate && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A geração está bloqueada. O funcionário deve apresentar os documentos marcados
              como bloqueadores antes que o documento possa ser gerado.
            </AlertDescription>
          </Alert>
        )}

        {compliance.requirements.map((req, i) => {
          const config = STATUS_CONFIG[req.status];
          const Icon = config.icon;

          return (
            <div
              key={`${req.documentType}-${i}`}
              className={`flex items-center justify-between p-3 rounded-md ${config.bg}`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
                <div>
                  <p className="text-sm font-medium">{req.label}</p>
                  {req.status === 'EXPIRED' && req.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Venceu em {new Date(req.expiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {req.blockGeneration && req.status !== 'OK' && (
                  <Badge variant="destructive" className="text-xs">Bloqueador</Badge>
                )}
                {!req.required && (
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                )}
                <Badge
                  variant={req.status === 'OK' ? 'default' : 'outline'}
                  className={`text-xs ${config.color}`}
                >
                  {config.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
