import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDashed,
  Database,
  FileText,
  Gauge,
  Heart,
  LineChart,
  Mail,
  Phone,
  PieChart,
  Plug,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { NormalizedShellWidget } from '@/hooks/dashboard/useDynamicDashboardShell';

const ICON_MAP: Record<string, LucideIcon> = {
  // Admin Center
  crm_health: Heart,
  integrations: Plug,
  data_quality: ShieldCheck,
  // Sales / Closer
  pipeline_open: Target,
  proposals_viewed: FileText,
  followups_pending: Phone,
  // SDR
  leads_today: Sparkles,
  qualified_leads: CheckCircle2,
  outreach_volume: Mail,
  // CS
  health_scores: Heart,
  renewals: CheckCircle2,
  tickets_open: Activity,
  // Finance / Operations
  fin_billing: Wallet,
  fin_contracts: FileText,
  ops_tasks: Wrench,
  ops_sla: Gauge,
  // Director / Owner
  exec_revenue: BarChart3,
  exec_pipeline: PieChart,
  exec_team: Users,
  dir_kpis: LineChart,
  dir_forecast: BarChart3,
  // Support / Dev / Automation
  sup_tickets: Activity,
  sup_csat: Heart,
  dev_releases: Wrench,
  dev_backlog: Database,
  auto_workflows: Sparkles,
  auto_agents: Sparkles,
  // Manager / User defaults
  manager_overview: Building2,
  user_overview: Users,
};

function pickIcon(key: string): LucideIcon {
  return ICON_MAP[key] || CircleDashed;
}

function statusBadge(status: string) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'placeholder') {
    return <Badge variant="outline">Placeholder</Badge>;
  }
  return <Badge variant="secondary">Não implementado</Badge>;
}

export function DynamicWidgetRenderer({ widget }: { widget: NormalizedShellWidget }) {
  const Icon = pickIcon(widget.key);
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-md bg-muted p-2 shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle className="text-sm font-medium truncate">{widget.label}</CardTitle>
          </div>
          {statusBadge(widget.status)}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        <p className="text-xs text-muted-foreground">
          {widget.description || 'Aguardando implementação dos dados reais.'}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground/70 truncate">{widget.key}</p>
      </CardContent>
    </Card>
  );
}
