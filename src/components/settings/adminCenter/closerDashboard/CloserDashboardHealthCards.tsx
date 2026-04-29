import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CloserHealthSummary } from '@/services/crm/closerDashboardObservability';

interface Props {
  health?: CloserHealthSummary;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  safe: 'default',
  attention: 'secondary',
  blocked: 'destructive',
};

const statusLabel: Record<string, string> = {
  safe: 'Seguro',
  attention: 'Atenção',
  blocked: 'Bloqueado',
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function CloserDashboardHealthCards({ health }: Props) {
  if (!health) {
    return <p className="text-sm text-muted-foreground">Carregando saúde...</p>;
  }
  const last = health.lastAllowedAt
    ? new Date(health.lastAllowedAt).toLocaleString('pt-BR')
    : '—';
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Pilotos ativos" value={health.activePilots} hint="Usuários comerciais com piloto ON" />
      <StatCard label="Acessos (7d)" value={health.allowedCount} />
      <StatCard label="Voltaram ao legado (7d)" value={health.choseLegacyCount} />
      <StatCard label="Fallbacks (7d)" value={health.fallbackCount} />
      <StatCard label="Erros (7d)" value={health.errorCount} />
      <StatCard
        label="Tempo médio"
        value={health.avgLoadMs != null ? `${health.avgLoadMs} ms` : '—'}
      />
      <StatCard label="Último acesso" value={last} hint={health.lastAllowedUserName ?? ''} />
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Status de rollout</p>
          <Badge variant={statusVariant[health.status]}>{statusLabel[health.status]}</Badge>
          {health.statusReasons.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {health.statusReasons.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
