import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, AlertCircle, FileWarning, ListChecks, Clock, Flame, Info } from 'lucide-react';
import type { CloserCentralCounts } from '@/types/dashboard/closer';

const HELP: Record<string, string> = {
  today_activities_count: 'Compromissos que precisam ser executados hoje.',
  overdue_followups_count: 'Pendências atrasadas que podem travar vendas.',
  proposals_expiring_today: 'Propostas que precisam de ação antes de perder força.',
  proposals_expiring_48h: 'Propostas que vencem nas próximas 48 horas.',
  proposals_expired: 'Propostas fora do prazo e ainda sem fechamento.',
  proposals_viewed_no_followup:
    'Clientes que abriram a proposta e ainda não receberam follow up.',
  opportunities_without_next_activity: 'Deals abertos sem próximo passo agendado.',
  stalled_opportunities: 'Deals sem avanço relevante há mais de 7 dias.',
};

function StatCard({
  label,
  value,
  icon: Icon,
  helpKey,
  variant = 'default',
}: {
  label: string;
  value: number;
  icon: any;
  helpKey: keyof typeof HELP;
  variant?: 'default' | 'attention' | 'critical';
}) {
  return (
    <div
      className={`rounded-md border p-3 flex items-start gap-3 ${
        variant === 'attention' ? 'border-amber-500/50' : ''
      } ${variant === 'critical' ? 'border-destructive/50' : ''}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Sobre ${label}`}
                >
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{HELP[helpKey]}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function CentralDoDiaSection({ central }: { central: CloserCentralCounts }) {
  const total =
    central.today_activities_count +
    central.overdue_followups_count +
    central.proposals_expiring_today +
    central.proposals_expiring_48h +
    central.proposals_expired +
    central.proposals_viewed_no_followup +
    central.opportunities_without_next_activity +
    central.stalled_opportunities;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Central do Dia</CardTitle>
        <p className="text-xs text-muted-foreground">
          O que precisa ser feito hoje para aumentar fechamento.
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nada crítico para agora. Revise o pipeline e busque novas oportunidades de avanço.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard
              label="Atividades de hoje"
              value={central.today_activities_count}
              icon={Calendar}
              helpKey="today_activities_count"
            />
            <StatCard
              label="Follow ups vencidos"
              value={central.overdue_followups_count}
              icon={AlertCircle}
              helpKey="overdue_followups_count"
              variant={central.overdue_followups_count > 0 ? 'attention' : 'default'}
            />
            <StatCard
              label="Propostas vencendo hoje"
              value={central.proposals_expiring_today}
              icon={FileWarning}
              helpKey="proposals_expiring_today"
              variant={central.proposals_expiring_today > 0 ? 'critical' : 'default'}
            />
            <StatCard
              label="Propostas vencendo em 48h"
              value={central.proposals_expiring_48h}
              icon={Clock}
              helpKey="proposals_expiring_48h"
              variant={central.proposals_expiring_48h > 0 ? 'attention' : 'default'}
            />
            <StatCard
              label="Propostas vencidas"
              value={central.proposals_expired}
              icon={FileWarning}
              helpKey="proposals_expired"
              variant={central.proposals_expired > 0 ? 'critical' : 'default'}
            />
            <StatCard
              label="Visualizadas sem ação"
              value={central.proposals_viewed_no_followup}
              icon={Flame}
              helpKey="proposals_viewed_no_followup"
              variant={central.proposals_viewed_no_followup > 0 ? 'attention' : 'default'}
            />
            <StatCard
              label="Sem próxima atividade"
              value={central.opportunities_without_next_activity}
              icon={ListChecks}
              helpKey="opportunities_without_next_activity"
            />
            <StatCard
              label="Oportunidades paradas"
              value={central.stalled_opportunities}
              icon={AlertCircle}
              helpKey="stalled_opportunities"
              variant={central.stalled_opportunities > 0 ? 'attention' : 'default'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
