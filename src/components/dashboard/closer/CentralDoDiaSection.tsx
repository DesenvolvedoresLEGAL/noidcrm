import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, AlertCircle, FileWarning, ListChecks, Clock, Flame } from 'lucide-react';
import type { CloserCentralCounts } from '@/types/dashboard/closer';

function StatCard({ label, value, icon: Icon, variant = 'default' }: { label: string; value: number; icon: any; variant?: 'default' | 'attention' | 'critical' }) {
  return (
    <div className={`rounded-md border p-3 flex items-center gap-3 ${variant === 'attention' ? 'border-amber-500/50' : ''} ${variant === 'critical' ? 'border-destructive/50' : ''}`}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function CentralDoDiaSection({ central }: { central: CloserCentralCounts }) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Central do Dia</CardTitle>
        <p className="text-xs text-muted-foreground">
          O que precisa ser feito hoje para aumentar fechamento.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard label="Atividades de hoje" value={central.today_activities_count} icon={Calendar} />
          <StatCard label="Follow ups vencidos" value={central.overdue_followups_count} icon={AlertCircle} variant={central.overdue_followups_count > 0 ? 'attention' : 'default'} />
          <StatCard label="Propostas vencendo hoje" value={central.proposals_expiring_today} icon={FileWarning} variant={central.proposals_expiring_today > 0 ? 'critical' : 'default'} />
          <StatCard label="Propostas vencendo em 48h" value={central.proposals_expiring_48h} icon={Clock} variant={central.proposals_expiring_48h > 0 ? 'attention' : 'default'} />
          <StatCard label="Propostas vencidas" value={central.proposals_expired} icon={FileWarning} variant={central.proposals_expired > 0 ? 'critical' : 'default'} />
          <StatCard label="Visualizadas sem ação" value={central.proposals_viewed_no_followup} icon={Flame} variant={central.proposals_viewed_no_followup > 0 ? 'attention' : 'default'} />
          <StatCard label="Sem próxima atividade" value={central.opportunities_without_next_activity} icon={ListChecks} />
          <StatCard label="Oportunidades paradas" value={central.stalled_opportunities} icon={AlertCircle} variant={central.stalled_opportunities > 0 ? 'attention' : 'default'} />
        </div>
      </CardContent>
    </Card>
  );
}
