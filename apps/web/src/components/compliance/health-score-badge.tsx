'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

interface HealthScore {
  overallScore: number;
  level: 'COMPLETE' | 'GOOD' | 'ATTENTION' | 'CRITICAL';
  observations: string[];
  pendingDocuments: string[];
  expiredDocuments: string[];
}

const LEVEL_CONFIG = {
  COMPLETE: {
    label: 'Completo',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  },
  GOOD: {
    label: 'Bom',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  },
  ATTENTION: {
    label: 'Atenção',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  },
  CRITICAL: {
    label: 'Crítico',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  },
};

interface Props {
  employeeId: string;
  showScore?: boolean;
}

export function HealthScoreBadge({ employeeId, showScore = false }: Props) {
  const { data } = useQuery<{ data: HealthScore }>({
    queryKey: ['health-score', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}/health-score`) as any,
    staleTime: 10 * 60 * 1000,
  });

  const score = data?.data;
  if (!score) return null;

  const config = LEVEL_CONFIG[score.level];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('cursor-help', config.className)}>
            {showScore && `${score.overallScore}% — `}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">Health Score: {score.overallScore}%</p>
            {score.observations.map((obs, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {obs}</p>
            ))}
            {score.pendingDocuments.length > 0 && (
              <p className="text-xs text-destructive">
                Pendente: {score.pendingDocuments.join(', ')}
              </p>
            )}
            {score.expiredDocuments.length > 0 && (
              <p className="text-xs text-destructive">
                Vencidos: {score.expiredDocuments.join(', ')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
