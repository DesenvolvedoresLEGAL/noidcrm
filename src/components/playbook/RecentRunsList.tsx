import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Trash2, Ban, Sparkles } from 'lucide-react';
import { useRetryPlaybookRun, useDeletePlaybookRun, useCancelPlaybookRun } from '@/hooks/useLeadSourcingV2';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  completed_empty: { label: 'Sem resultados', icon: AlertTriangle, color: 'text-amber-500' },
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

function formatMs(ms: number | null | undefined): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RecentRunsList({ runs, selectedRunId, onSelect }: RecentRunsListProps) {
  const retryMutation = useRetryPlaybookRun();
  const deleteMutation = useDeletePlaybookRun();
  const cancelMutation = useCancelPlaybookRun();
  const queryClient = useQueryClient();
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const [cancelRunId, setCancelRunId] = useState<string | null>(null);

  const rescoreMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('rescore-prospects', {
        body: { run_id: runId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const total = data?.total ?? 0;
      const rescored = data?.rescored ?? 0;
      const learning = data?.learning_signals_active ?? 0;
      if (learning === 0) {
        toast.info('Re-pontuação concluída', {
          description: 'Nenhum learning signal ativo (confiança ≥ 0.2). Scores não mudaram. Continue rodando o sistema para acumular aprendizado.',
        });
      } else {
        toast.success('Re-pontuação concluída', {
          description: `${rescored} de ${total} prospects atualizados com base em ${learning} sinais aprendidos.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['lead-sourcing-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
    },
    onError: (e: any) => toast.error('Falha ao re-pontuar', { description: e.message }),
  });

  if (!runs.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Execuções Recentes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {runs.map(run => {
          const status = statusConfig[run.status] || statusConfig.queued;
          const StatusIcon = status.icon;
          const payload = run.input_payload as Record<string, any> | null;
          const playbookType = payload?.playbookType || payload?.search_type || 'unknown';
          const originName =
            payload?.event_name ||
            payload?.directory_name ||
            payload?.source_name ||
            payload?.geo_name ||
            payload?.name ||
            (payload?.event_url ? new URL(payload.event_url).hostname.replace(/^www\./, '') : null);
          const prospectsCount = (run.stats as any)?.persisted_prospects || (run.stats as any)?.prospects_created || (run.stats as any)?.prospects_count || 0;
          const approvedCount = (run.stats as any)?.approved_count || 0;
          const timeStr = formatMs(run.execution_time_ms);

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
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline" className="mb-1.5">
                      {typeLabels[playbookType] || playbookType}
                    </Badge>
                    {originName && (
                      <div className="text-sm font-semibold truncate" title={originName}>
                        {originName}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(run.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <div className="font-medium">{prospectsCount} leads</div>
                    {approvedCount > 0 && (
                      <div className="text-green-600">{approvedCount} aprovados</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className={cn('flex items-center gap-1.5 text-xs', status.color)}>
                    <StatusIcon className={cn('h-3.5 w-3.5', run.status === 'running' && 'animate-spin')} />
                    {status.label}
                    {run.error_summary && (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {timeStr && (
                      <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                    )}
                    {run.status === 'failed' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); retryMutation.mutate(run.id); }}
                        disabled={retryMutation.isPending}
                        title="Tentar novamente"
                      >
                        <RefreshCw className={cn('h-3 w-3', retryMutation.isPending && 'animate-spin')} />
                      </Button>
                    )}
                    {run.status === 'completed' && prospectsCount > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-primary"
                        onClick={(e) => { e.stopPropagation(); rescoreMutation.mutate(run.id); }}
                        disabled={rescoreMutation.isPending}
                        title="Re-pontuar com aprendizado atual (Score V3)"
                      >
                        <Sparkles className={cn('h-3 w-3', rescoreMutation.isPending && rescoreMutation.variables === run.id && 'animate-pulse')} />
                      </Button>
                    )}
                    {(run.status === 'running' || run.status === 'queued') && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-amber-500 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setCancelRunId(run.id); }}
                        disabled={cancelMutation.isPending}
                        title="Cancelar execução"
                      >
                        <Ban className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteRunId(run.id); }}
                      disabled={run.status === 'running'}
                      title="Deletar execução"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DeleteConfirmationDialog
        open={!!deleteRunId}
        onOpenChange={(open) => !open && setDeleteRunId(null)}
        onConfirm={() => {
          if (deleteRunId) {
            deleteMutation.mutate(deleteRunId);
            setDeleteRunId(null);
          }
        }}
        title="Deletar execução"
        description="Todos os leads, scores e eventos dessa execução serão removidos permanentemente."
        isLoading={deleteMutation.isPending}
      />

      <DeleteConfirmationDialog
        open={!!cancelRunId}
        onOpenChange={(open) => !open && setCancelRunId(null)}
        onConfirm={() => {
          if (cancelRunId) {
            cancelMutation.mutate(cancelRunId);
            setCancelRunId(null);
          }
        }}
        title="Cancelar execução"
        description="A execução será marcada como falhada. Os dados já capturados (se houver) serão preservados."
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
