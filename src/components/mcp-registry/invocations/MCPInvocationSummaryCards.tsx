import { MCPMetricCard } from '../MCPMetricCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, FlaskConical, Shield, CheckCircle2, XCircle, Clock, Calendar, Zap } from 'lucide-react';
import type { McpInvocationMetrics } from '@/services/mcp-registry/types';

interface Props {
  metrics: McpInvocationMetrics | undefined;
  loading?: boolean;
}

export function MCPInvocationSummaryCards({ metrics, loading }: Props) {
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
      <MCPMetricCard label="Invocations totais" value={metrics.total} icon={Activity} />
      <MCPMetricCard label="Simuladas" value={metrics.simulated} icon={FlaskConical} />
      <MCPMetricCard label="Bloqueadas" value={metrics.blocked} icon={Shield} variant="warning" />
      <MCPMetricCard label="Com sucesso" value={metrics.success} icon={CheckCircle2} variant="success" />
      <MCPMetricCard label="Com erro" value={metrics.failed} icon={XCircle} variant="warning" />
      <MCPMetricCard label="Pending approval" value={metrics.pending_approval} icon={Clock} />
      <MCPMetricCard label="Últimas 24h" value={metrics.last_24h} icon={Calendar} />
      <MCPMetricCard label="Volts consumidos" value={metrics.volts_consumed} icon={Zap} variant="muted" />
    </div>
  );
}
