import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity } from 'lucide-react';
import { fetchRuntimeLogs, fetchRuntimeStats } from '@/services/crm/dynamicDashboardRuntimeLogs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  tenantId: string;
}

const EVENT_LABEL: Record<string, string> = {
  runtime_allowed: 'Acesso runtime',
  runtime_fallback: 'Fallback automático',
  runtime_error: 'Erro runtime',
  user_chose_legacy_dashboard: 'Voltou ao legado',
  user_returned_to_dynamic_dashboard: 'Retornou ao novo',
};

const EVENT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  runtime_allowed: 'default',
  runtime_fallback: 'secondary',
  runtime_error: 'destructive',
  user_chose_legacy_dashboard: 'outline',
  user_returned_to_dynamic_dashboard: 'outline',
};

export function RuntimeAccessLog({ tenantId }: Props) {
  const logsQ = useQuery({
    queryKey: ['runtime-access-log', tenantId],
    queryFn: () => fetchRuntimeLogs(tenantId, 50),
    staleTime: 60_000,
  });
  const statsQ = useQuery({
    queryKey: ['runtime-access-stats', tenantId],
    queryFn: () => fetchRuntimeStats(tenantId),
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Runtime do Dashboard Comercial
        </CardTitle>
        <CardDescription>
          Eventos de substituição automática da home, fallbacks e escolhas manuais do usuário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statsQ.isLoading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Allowed (30d)" value={statsQ.data?.totals.runtime_allowed ?? 0} />
            <Stat label="Fallbacks (30d)" value={statsQ.data?.totals.runtime_fallback ?? 0} />
            <Stat label="Erros (30d)" value={statsQ.data?.totals.runtime_error ?? 0} />
            <Stat
              label="Tempo médio"
              value={statsQ.data?.avgLoadMs != null ? `${statsQ.data.avgLoadMs} ms` : '—'}
            />
          </div>
        )}

        {logsQ.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !logsQ.data?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
            {logsQ.data.map((row) => (
              <div key={row.id} className="p-2 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={EVENT_VARIANT[row.event_type] ?? 'outline'}>
                    {EVENT_LABEL[row.event_type] ?? row.event_type}
                  </Badge>
                  <span className="text-muted-foreground truncate">
                    {row.fallback_reason ?? row.error_message ?? row.profile_key ?? ''}
                  </span>
                  {row.load_ms != null && (
                    <span className="text-muted-foreground">{row.load_ms} ms</span>
                  )}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
