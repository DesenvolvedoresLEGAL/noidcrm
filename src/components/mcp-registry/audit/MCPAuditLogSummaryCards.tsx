import { MCPMetricCard } from '../MCPMetricCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Calendar, CalendarDays, Shield, FileText, Settings, Sprout, Ban } from 'lucide-react';
import type { McpAuditMetrics } from '@/services/mcp-registry/types';

interface Props {
  metrics: McpAuditMetrics | undefined;
  loading?: boolean;
}

export function MCPAuditLogSummaryCards({ metrics, loading }: Props) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MCPMetricCard label="Audit logs totais" value={metrics.total} icon={Activity} />
      <MCPMetricCard label="Últimas 24h" value={metrics.last_24h} icon={Calendar} />
      <MCPMetricCard label="Últimos 7 dias" value={metrics.last_7d} icon={CalendarDays} />
      <MCPMetricCard label="Eventos de permission" value={metrics.permission_events} icon={Shield} />
      <MCPMetricCard label="Eventos de invocation" value={metrics.invocation_events} icon={FileText} />
      <MCPMetricCard label="Eventos de settings" value={metrics.settings_events} icon={Settings} />
      <MCPMetricCard label="Eventos de seeds" value={metrics.seed_events} icon={Sprout} variant="muted" />
      <MCPMetricCard label="Eventos bloqueados" value={metrics.blocked_events} icon={Ban} variant="warning" />
    </div>
  );
}
