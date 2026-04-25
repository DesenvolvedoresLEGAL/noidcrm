import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePlaybookRunsPaginated, useRetryPlaybookRun } from '@/hooks/useLeadSourcingV2';
import type { PlaybookRun } from '@/hooks/useLeadSourcingV2';

interface RunHistoryTableProps {
  onSelectRun: (run: PlaybookRun) => void;
  onViewProspects: (runId: string) => void;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  queued: { label: 'Na fila', icon: Clock, color: 'text-muted-foreground' },
  running: { label: 'Executando', icon: Loader2, color: 'text-amber-500' },
  completed: { label: 'Concluída', icon: CheckCircle2, color: 'text-green-600' },
  failed: { label: 'Falhou', icon: XCircle, color: 'text-destructive' },
};

const typeLabels: Record<string, string> = {
  manual_import: 'Importação',
  import: 'Importação',
  event: 'Evento',
  directory: 'Diretório',
  geo: 'Geográfica',
  seed: 'Seed',
};

function formatMs(ms: number | null | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RunHistoryTable({ onSelectRun, onViewProspects }: RunHistoryTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const { data, isLoading } = usePlaybookRunsPaginated(page, pageSize);
  const retryMutation = useRetryPlaybookRun();

  const runs = data?.runs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!runs.length) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          Nenhuma execução encontrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Histórico de Execuções
          <Badge variant="secondary">{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Prospects</TableHead>
              <TableHead className="text-right">Aprovados</TableHead>
              <TableHead className="text-right">Importados</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map(run => {
              const status = statusConfig[run.status] || statusConfig.queued;
              const StatusIcon = status.icon;
              const playbookType = run.input_payload?.playbookType || 'unknown';
              const source = run.input_payload?.event_name
                || run.input_payload?.eventName
                || run.input_payload?.directoryName
                || run.input_payload?.location
                || '—';
              const prospectsCount = (run.stats as any)?.persisted_prospects || (run.stats as any)?.prospects_created || (run.stats as any)?.prospects_count || 0;
              const approvedCount = (run.stats as any)?.approved_count || 0;
              const importedCount = (run.stats as any)?.imported_count || 0;

              return (
                <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectRun(run)}>
                  <TableCell className="text-sm">
                    {format(new Date(run.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[playbookType] || playbookType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium max-w-[220px] truncate" title={source}>
                    {source}
                  </TableCell>
                  <TableCell>
                    <div className={cn('flex items-center gap-1.5 text-xs font-medium', status.color)}>
                      <StatusIcon className={cn('h-3.5 w-3.5', run.status === 'running' && 'animate-spin')} />
                      {status.label}
                      {run.error_summary && (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{prospectsCount}</TableCell>
                  <TableCell className="text-right text-green-600">{approvedCount}</TableCell>
                  <TableCell className="text-right">{importedCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {formatMs(run.execution_time_ms)}
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onViewProspects(run.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {run.status === 'failed' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-amber-600"
                          onClick={() => retryMutation.mutate(run.id)}
                          disabled={retryMutation.isPending}
                        >
                          <RefreshCw className={cn('h-3.5 w-3.5', retryMutation.isPending && 'animate-spin')} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
