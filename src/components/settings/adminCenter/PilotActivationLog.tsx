import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { usePilotLogs } from '@/hooks/dashboard/useCloserDashboardPilot';
import { format } from 'date-fns';

const ACTION_LABEL: Record<string, string> = {
  enable_pilot: 'Piloto habilitado',
  disable_user_pilot: 'Piloto desligado (usuário)',
  disable_tenant_dynamic_dashboard: 'Dashboards dinâmicos desligados (tenant)',
  rollback: 'Rollback',
};

const ACTION_VARIANT: Record<string, any> = {
  enable_pilot: 'default',
  disable_user_pilot: 'outline',
  disable_tenant_dynamic_dashboard: 'destructive',
  rollback: 'destructive',
};

export function PilotActivationLog({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = usePilotLogs(tenantId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logs de ativação do piloto</CardTitle>
        <p className="text-sm text-muted-foreground">
          Histórico de ativações e rollbacks do dashboard dinâmico (Sprint 6.3).
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ativação registrada ainda.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.map((log) => (
              <div
                key={log.id}
                className="border rounded-md p-3 text-sm flex flex-col gap-1"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge variant={ACTION_VARIANT[log.action]}>
                    {ACTION_LABEL[log.action] ?? log.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Target: <span className="font-mono">{log.target_user_id.slice(0, 8)}...</span></div>
                  <div>Por: <span className="font-mono">{log.changed_by.slice(0, 8)}...</span></div>
                  <div>
                    Global: {String(log.previous_global_flag)} → {String(log.new_global_flag)}
                    {' · '}
                    User: {String(log.previous_user_flag)} → {String(log.new_user_flag)}
                  </div>
                  {log.reason && <div>Motivo: {log.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
