import { useState } from 'react';
import { useAutopilotRuns, useAutopilotControl } from '@/hooks/intelligence/useAutopilot';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Pause, Play, X, Eye } from 'lucide-react';
import { AutopilotRunDrawer } from './AutopilotRunDrawer';
import type { AutopilotRun, AutopilotStatus } from '@/services/intelligence/autopilot';

const STATUS_VARIANT: Record<AutopilotStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline', running: 'default', paused: 'secondary',
  completed: 'secondary', failed: 'destructive', cancelled: 'outline',
};

export function AutopilotRunsTable() {
  const { data: runs, isLoading } = useAutopilotRuns();
  const control = useAutopilotControl();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!runs?.length) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Nenhuma execução do Autopilot ainda. Clique em "Executar Autopilot" para começar.
      </Card>
    );
  }

  const renderActions = (run: AutopilotRun) => (
    <div className="flex gap-1">
      <Button size="icon" variant="ghost" onClick={() => setSelectedId(run.id)} title="Detalhes">
        <Eye className="h-4 w-4" />
      </Button>
      {run.status === 'running' && (
        <Button size="icon" variant="ghost" onClick={() => control.mutate({ run_id: run.id, action: 'pause' })} title="Pausar">
          <Pause className="h-4 w-4" />
        </Button>
      )}
      {run.status === 'paused' && (
        <Button size="icon" variant="ghost" onClick={() => control.mutate({ run_id: run.id, action: 'resume' })} title="Retomar">
          <Play className="h-4 w-4" />
        </Button>
      )}
      {['pending', 'running', 'paused'].includes(run.status) && (
        <Button size="icon" variant="ghost" onClick={() => control.mutate({ run_id: run.id, action: 'cancel' })} title="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Execução</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => {
              const pct = r.total_prospects ? Math.round(((r.processed + r.skipped + r.failed) / r.total_prospects) * 100) : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.run_name}</div>
                    <div className="text-xs text-muted-foreground">{r.run_type}</div>
                  </TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="w-48">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span>{r.processed + r.skipped + r.failed}/{r.total_prospects}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      {r.failed > 0 && <span className="text-xs text-destructive">{r.failed} falhas</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.credits_used} / {r.credits_estimated}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell className="text-right">{renderActions(r)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <AutopilotRunDrawer runId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
