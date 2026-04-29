import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug } from 'lucide-react';
import { auditCommercialDashboard } from '@/services/crm/commercialDashboardAudit';
import type { ActiveCloserPilot, EligibleCloser } from '@/services/crm/closerDashboardObservability';

interface Props {
  tenantId: string;
  activePilots: ActiveCloserPilot[];
  eligibleClosers: EligibleCloser[];
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtNum(v: number | null | undefined) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3 bg-muted/30">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}

export function CloserDashboardReconciliation({ tenantId, activePilots, eligibleClosers }: Props) {
  const candidates = [
    ...activePilots.map((p) => ({ id: p.userId, label: p.fullName ?? p.email ?? p.userId })),
    ...eligibleClosers.map((p) => ({ id: p.userId, label: p.fullName ?? p.email ?? p.userId })),
  ];
  const [userId, setUserId] = useState<string | null>(candidates[0]?.id ?? null);

  const { data } = useQuery({
    queryKey: ['commercial-dashboard-reconciliation', tenantId, userId],
    queryFn: () => auditCommercialDashboard(tenantId, userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Reconciliação debug (Owner/Admin)
            </CardTitle>
            <CardDescription>
              Totais brutos para conferência com as telas operacionais. Não exposto ao vendedor.
            </CardDescription>
          </div>
          <Select
            value={userId ?? undefined}
            onValueChange={(v) => setUserId(v)}
            disabled={candidates.length === 0}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Selecione um comercial" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground">Selecione um usuário para ver os totais.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Oportunidades abertas" value={fmtNum(data.totals.open_opportunities_count)} />
            <Stat label="Pipeline aberto" value={fmtBRL(data.totals.open_opportunities_value)} />
            <Stat label="Propostas abertas" value={fmtNum(data.totals.open_proposals_count)} />
            <Stat label="Valor propostas abertas" value={fmtBRL(data.totals.open_proposals_value)} />
            <Stat label="Atividades hoje" value={fmtNum(data.totals.activities_today_count)} />
            <Stat label="Atividades atrasadas" value={fmtNum(data.totals.overdue_activities_count)} />
            <Stat label="Ganhos no mês (qtd)" value={fmtNum(data.totals.won_count_month)} />
            <Stat label="Perdidos no mês (qtd)" value={fmtNum(data.totals.lost_count_month)} />
            <Stat label="Ganhos no mês (valor)" value={fmtBRL(data.totals.won_revenue_month)} />
            <Stat label="Meta do mês" value={fmtBRL(data.totals.goal_value)} />
            <Stat label="Realizado (pace)" value={fmtBRL(data.totals.realized_value)} />
            <Stat label="Pace esperado hoje" value={fmtBRL(data.totals.expected_pace_today)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
