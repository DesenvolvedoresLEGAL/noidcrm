import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { usePushQueueHealth } from '@/hooks/usePushQueueHealth';

interface Props {
  organizationId?: string | null;
}

export function PushQueueHealthCard({ organizationId }: Props) {
  const { data, isLoading, refetch, isFetching } = usePushQueueHealth(organizationId, 24);

  if (!organizationId) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Saúde da Fila de Push
            </CardTitle>
            <CardDescription>
              Snapshot operacional da push_delivery_jobs (últimas 24h)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground">Carregando métricas da fila...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Pendentes" value={data.pending_count} />
              <Metric label="Processando" value={data.processing_count} />
              <Metric label="Enviados" value={data.sent_count} />
              <Metric label="Falhos" value={data.failed_count} />
              <Metric label="Exauridos" value={data.exhausted_count} />
              <Metric label="Retrying" value={data.retrying_count} />
              <Metric label="Falhas recentes" value={data.recent_failed_count} />
            </div>

            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Top erros recentes
              </div>
              {data.recent_errors.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem padrões de erro recentes.</div>
              ) : (
                <div className="space-y-1.5">
                  {data.recent_errors.slice(0, 10).map((e, idx) => (
                    <div
                      key={`${e.error}-${idx}`}
                      className="flex items-center justify-between border rounded-md px-3 py-2"
                    >
                      <span className="text-xs font-mono text-muted-foreground truncate pr-3">
                        {e.error}
                      </span>
                      <Badge variant="secondary">{e.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
