import { MCPMetricCard } from '../MCPMetricCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ShieldCheck, Bot, User, KeyRound, Zap, Lock } from 'lucide-react';
import { useMcpPermissionMetrics } from '@/hooks/useMcpRegistry';

export function MCPPermissionSummaryCards() {
  const { data, isLoading } = useMcpPermissionMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  const m = data ?? {
    total: 0, active: 0, inactive: 0, archived: 0,
    by_agent: 0, by_user: 0, by_role: 0,
    with_execute: 0, with_approval: 0,
  };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MCPMetricCard label="Permissões totais" value={m.total} icon={Shield} hint={`${m.archived} arquivadas`} />
      <MCPMetricCard label="Permissões ativas" value={m.active} icon={ShieldCheck} variant="success" hint={`${m.inactive} inativas`} />
      <MCPMetricCard label="Por agente" value={m.by_agent} icon={Bot} variant="muted" />
      <MCPMetricCard label="Por usuário" value={m.by_user} icon={User} variant="muted" />
      <MCPMetricCard label="Por papel" value={m.by_role} icon={KeyRound} variant="muted" />
      <MCPMetricCard label="Com execução" value={m.with_execute} icon={Zap} variant="warning" />
      <MCPMetricCard label="Exigem aprovação" value={m.with_approval} icon={Lock} variant="default" />
    </div>
  );
}
