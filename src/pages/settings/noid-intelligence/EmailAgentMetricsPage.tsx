import { useState } from 'react';
import { Mail, Eye, MessageSquare, ArrowUpRight, Ban, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEmailAgentMetricsSummary } from '@/hooks/useEmailAgentMetrics';

function formatPct(val: number) { return `${val.toFixed(1)}%`; }
function formatCost(val: number) { return `R$ ${val.toFixed(4)}`; }

export default function EmailAgentMetricsPage() {
  const { data: user } = useCurrentUser();
  const orgId = user?.organization?.id;
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [period, setPeriod] = useState('7d');

  const { data: agents } = useQuery({
    queryKey: ['agents-for-metrics', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
      return data || [];
    },
    enabled: !!orgId,
  });

  const dateFrom = (() => {
    const d = new Date();
    if (period === '24h') d.setDate(d.getDate() - 1);
    else if (period === '7d') d.setDate(d.getDate() - 7);
    else if (period === '30d') d.setDate(d.getDate() - 30);
    else d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  })();

  const filters = selectedAgentId ? { agent_id: selectedAgentId, date_from: dateFrom } : null;
  const { data: summary } = useEmailAgentMetricsSummary(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Métricas do Email Agent</h1>
        <p className="text-muted-foreground mt-1">Performance, engajamento e impacto operacional.</p>
      </div>

      <div className="flex gap-3">
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar agente" /></SelectTrigger>
          <SelectContent>
            {agents?.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="90d">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!selectedAgentId ? (
        <p className="text-muted-foreground text-sm">Selecione um agente para ver as métricas.</p>
      ) : !summary ? (
        <p className="text-muted-foreground text-sm">Sem dados para o período selecionado.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <KPICard icon={Mail} label="Enviados" value={summary.emails_sent} />
            <KPICard icon={Eye} label="Open Rate" value={formatPct(summary.open_rate)} />
            <KPICard icon={MessageSquare} label="Reply Rate" value={formatPct(summary.reply_rate)} />
            <KPICard icon={ArrowUpRight} label="Advance Rate" value={formatPct(summary.advance_rate)} />
            <KPICard icon={Ban} label="Cooldown Blocks" value={summary.cooldown_blocks} />
            <KPICard icon={DollarSign} label="Custo/Reply" value={formatCost(summary.cost_per_reply)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Gerados</p><p className="text-2xl font-bold">{summary.emails_generated}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Aprovados</p><p className="text-2xl font-bold">{summary.emails_approved}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Rejeitados</p><p className="text-2xl font-bold text-destructive">{summary.emails_rejected}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Bounces</p><p className="text-2xl font-bold text-destructive">{summary.bounced}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Oportunidades Avançadas</p><p className="text-2xl font-bold text-primary">{summary.opportunities_advanced}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Reativações</p><p className="text-2xl font-bold text-primary">{summary.opportunities_reactivated}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Deals Influenciados</p><p className="text-2xl font-bold text-primary">{summary.influenced_deals}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Eficiência Operacional</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-muted-foreground">Human Edit Rate</p><p className="text-lg font-semibold">{formatPct(summary.human_edit_rate)}</p></div>
                <div><p className="text-xs text-muted-foreground">Cooldown Block Rate</p><p className="text-lg font-semibold">{formatPct(summary.cooldown_block_rate)}</p></div>
                <div><p className="text-xs text-muted-foreground">Policy Blocks</p><p className="text-lg font-semibold">{summary.policy_blocks}</p></div>
                <div><p className="text-xs text-muted-foreground">Custo Total</p><p className="text-lg font-semibold">{formatCost(summary.estimated_cost)}</p></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
