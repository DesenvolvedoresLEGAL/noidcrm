import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { PlaybookRun } from '@/hooks/useLeadSourcingV2';

interface RecentRunsListProps {
  runs: PlaybookRun[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  queued: { label: 'Na fila', icon: Clock, color: 'text-muted-foreground' },
  running: { label: 'Executando...', icon: Loader2, color: 'text-amber-500' },
  completed: { label: 'Concluída', icon: CheckCircle2, color: 'text-green-500' },
  failed: { label: 'Falhou', icon: XCircle, color: 'text-destructive' },
};

const typeLabels: Record<string, string> = {
  manual_import: 'Importação',
  event: 'Evento',
  directory: 'Diretório',
  geo: 'Geográfica',
  seed: 'Seed',
  import: 'Importação',
};

export function RecentRunsList({ runs, selectedRunId, onSelect }: RecentRunsListProps) {
  if (!runs.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Execuções Recentes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {runs.map(run => {
          const status = statusConfig[run.status] || statusConfig.queued;
          const StatusIcon = status.icon;
          const playbookType = run.input_payload?.playbookType || run.input_payload?.search_type || 'unknown';
          const prospectsCount = (run.stats as any)?.prospects_count || 0;
          const approvedCount = (run.stats as any)?.approved_count || 0;

          return (
            <Card
              key={run.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                selectedRunId === run.id && 'ring-2 ring-primary'
              )}
              onClick={() => onSelect(run.id)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="mb-1.5">
                      {typeLabels[playbookType] || playbookType}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(run.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-medium">{prospectsCount} leads</div>
                    {approvedCount > 0 && (
                      <div className="text-green-600">{approvedCount} aprovados</div>
                    )}
                  </div>
                </div>
                <div className={cn('flex items-center gap-1.5 mt-2 text-xs', status.color)}>
                  <StatusIcon className={cn('h-3.5 w-3.5', run.status === 'running' && 'animate-spin')} />
                  {status.label}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
