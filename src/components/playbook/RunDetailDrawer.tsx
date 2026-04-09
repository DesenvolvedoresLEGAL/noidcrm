import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRunEvents, useRetryPlaybookRun } from '@/hooks/useLeadSourcingV2';
import type { PlaybookRun } from '@/hooks/useLeadSourcingV2';

interface RunDetailDrawerProps {
  run: PlaybookRun | null;
  open: boolean;
  onClose: () => void;
  onViewProspects: (runId: string) => void;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  queued: { label: 'Na fila', icon: Clock, color: 'text-muted-foreground' },
  running: { label: 'Executando', icon: Loader2, color: 'text-amber-500' },
  completed: { label: 'Concluída', icon: CheckCircle2, color: 'text-green-600' },
  failed: { label: 'Falhou', icon: XCircle, color: 'text-destructive' },
};

const levelIcons: Record<string, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

const levelColors: Record<string, string> = {
  info: 'text-blue-500',
  warn: 'text-amber-500',
  error: 'text-destructive',
};

function formatMs(ms: number | null | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RunDetailDrawer({ run, open, onClose, onViewProspects }: RunDetailDrawerProps) {
  const { data: events = [] } = useRunEvents(run?.id || null);
  const retryMutation = useRetryPlaybookRun();

  if (!run) return null;

  const status = statusConfig[run.status] || statusConfig.queued;
  const StatusIcon = status.icon;
  const stats = run.stats as any;
  const playbookType = run.input_payload?.playbookType || 'unknown';

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">Detalhe da Execução</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Resumo */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <div className={cn('flex items-center gap-1.5 font-medium', status.color)}>
                  <StatusIcon className={cn('h-4 w-4', run.status === 'running' && 'animate-spin')} />
                  {status.label}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Tipo</span>
                <div className="font-medium capitalize">{playbookType}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Tempo</span>
                <div className="font-medium">{formatMs(run.execution_time_ms)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Retries</span>
                <div className="font-medium">{run.retry_count || 0}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Criado em</span>
                <div className="font-medium">
                  {format(new Date(run.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                </div>
              </div>
              {run.finished_at && (
                <div>
                  <span className="text-muted-foreground text-xs">Finalizado</span>
                  <div className="font-medium">
                    {format(new Date(run.finished_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Error */}
          {run.error_summary && (
            <>
              <Separator />
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />Erro
                </h4>
                <div className="text-sm p-3 rounded-md bg-destructive/5 border border-destructive/20 text-destructive">
                  {run.error_summary}
                </div>
              </section>
            </>
          )}

          <Separator />

          {/* Stats */}
          {stats && Object.keys(stats).length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métricas</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm p-2 rounded-md bg-muted/50">
                    <span className="text-muted-foreground text-xs">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Separator />

          {/* Events Timeline */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Log de Eventos ({events.length})
            </h4>
            {events.length > 0 ? (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {events.map(event => {
                    const Icon = levelIcons[event.level] || Info;
                    const color = levelColors[event.level] || 'text-muted-foreground';
                    return (
                      <div key={event.id} className="flex gap-2 text-sm">
                        <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', color)} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{event.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(event.created_at), "HH:mm:ss", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento registrado
              </div>
            )}
          </section>

          <Separator />

          {/* Input Payload */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Input Payload</h4>
            <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-[200px]">
              {JSON.stringify(run.input_payload, null, 2)}
            </pre>
          </section>
        </div>

        <SheetFooter className="flex gap-2 pt-4 border-t">
          {run.status === 'failed' && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => retryMutation.mutate(run.id)}
              disabled={retryMutation.isPending}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', retryMutation.isPending && 'animate-spin')} />
              Retry
            </Button>
          )}
          <Button className="flex-1" onClick={() => { onViewProspects(run.id); onClose(); }}>
            Ver Prospects
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
