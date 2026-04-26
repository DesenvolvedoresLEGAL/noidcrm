import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MCPMetricCard } from '../MCPMetricCard';
import { useMcpOverviewMetrics, useMcpSettings, useMcpPermissionMetrics, useMcpInvocationMetrics, useMcpAuditMetrics } from '@/hooks/useMcpRegistry';
import {
  Server,
  Wrench,
  Database,
  FileText,
  ShieldCheck,
  ShieldX,
  Clock,
  Gauge,
  Shield,
  Zap,
  Lock,
  Activity,
  FlaskConical,
  CheckCircle2,
  Calendar,
  CalendarDays,
  History,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function OverviewTab() {
  const { data: metrics, isLoading: metricsLoading } = useMcpOverviewMetrics();
  const { data: settings, isLoading: settingsLoading } = useMcpSettings();
  const { data: permMetrics } = useMcpPermissionMetrics();
  const { data: invMetrics } = useMcpInvocationMetrics();
  const { data: auditMetrics } = useMcpAuditMetrics();

  if (metricsLoading || settingsLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const m = metrics ?? {
    servers: { total: 0, active: 0, draft: 0, inactive: 0, archived: 0 },
    tools: { total: 0, enabled: 0, disabled: 0 },
    resources: { total: 0, enabled: 0, disabled: 0 },
    prompts: { total: 0, active: 0, draft: 0, archived: 0 },
  };

  return (
    <div className="space-y-6">
      {/* Status da Organização */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground mr-2">Status MCP da organização:</span>
          {settings?.is_mcp_enabled ? (
            <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100">
              <ShieldCheck className="h-3 w-3" /> MCP ativo
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldX className="h-3 w-3" /> MCP desativado
            </Badge>
          )}
          {settings?.allow_external_servers ? (
            <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">
              <ShieldCheck className="h-3 w-3" /> Servidores externos permitidos
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldX className="h-3 w-3" /> Servidores externos bloqueados
            </Badge>
          )}
          {settings && (
            <>
              <Badge variant="outline" className="gap-1">
                <Gauge className="h-3 w-3" /> Limite diário: {settings.default_daily_call_limit}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" /> Logs: {settings.log_retention_days}d
              </Badge>
            </>
          )}
          {!settings && (
            <Badge variant="outline" className="text-muted-foreground">
              Settings não criadas — vá para a aba Settings
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MCPMetricCard label="Servidores" value={m.servers.total} icon={Server} hint={`${m.servers.active} ativos · ${m.servers.draft} draft`} />
        <MCPMetricCard label="Tools" value={m.tools.total} icon={Wrench} variant="warning" hint={`${m.tools.enabled} habilitadas · ${m.tools.disabled} desabilitadas`} />
        <MCPMetricCard label="Resources" value={m.resources.total} icon={Database} variant="muted" hint={`${m.resources.enabled} habilitados · ${m.resources.disabled} desabilitados`} />
        <MCPMetricCard label="Prompts" value={m.prompts.total} icon={FileText} variant="success" hint={`${m.prompts.active} ativos · ${m.prompts.draft} draft`} />
      </div>

      {/* Permissões (Sprint 1.4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MCPMetricCard label="Permissões totais" value={permMetrics?.total ?? 0} icon={Shield} />
        <MCPMetricCard label="Permissões ativas" value={permMetrics?.active ?? 0} icon={ShieldCheck} variant="success" />
        <MCPMetricCard label="Com execução liberada" value={permMetrics?.with_execute ?? 0} icon={Zap} variant="warning" />
        <MCPMetricCard label="Exigem aprovação" value={permMetrics?.with_approval ?? 0} icon={Lock} />
      </div>

      {/* Bloco explicativo */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="text-base font-semibold text-foreground">Fundação MCP do NOID Intelligence</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta camada organiza tools, resources e prompts que poderão ser usados pelos agentes. Todas as ações
            futuras passarão por permissões, auditoria e logs. Nesta fase, nenhuma tool executa ações externas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
