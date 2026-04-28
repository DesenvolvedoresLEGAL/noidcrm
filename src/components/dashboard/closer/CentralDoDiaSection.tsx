import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CloserCentralDoDia, CloserAgendaItem, CloserOverdueFollowup, CloserProposalAction, CloserNextAction } from '@/types/dashboard/closer';
import { Calendar, AlertCircle, FileWarning, ListChecks } from 'lucide-react';

interface Props {
  central: CloserCentralDoDia;
  agenda: CloserAgendaItem[];
  overdue: CloserOverdueFollowup[];
  proposalsAction: CloserProposalAction[];
  nextActions: CloserNextAction[];
}

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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function CentralDoDiaSection({ central, agenda, overdue, proposalsAction, nextActions }: Props) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Central do Dia</CardTitle>
        <p className="text-xs text-muted-foreground">
          Atividades, follow ups, propostas vencendo e oportunidades que não podem esfriar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard label="Atividades de hoje" value={central.today_activities_count} icon={Calendar} />
          <StatCard label="Follow ups vencidos" value={central.overdue_followups_count} icon={AlertCircle} variant={central.overdue_followups_count > 0 ? 'attention' : 'default'} />
          <StatCard label="Propostas vencendo hoje" value={central.proposals_expiring_today} icon={FileWarning} variant={central.proposals_expiring_today > 0 ? 'attention' : 'default'} />
          <StatCard label="Propostas vencendo em 48h" value={central.proposals_expiring_48h} icon={FileWarning} />
          <StatCard label="Propostas vencidas" value={central.proposals_expired} icon={FileWarning} variant={central.proposals_expired > 0 ? 'critical' : 'default'} />
          <StatCard label="Visualizadas sem follow up" value={central.proposals_viewed_no_followup} icon={ListChecks} />
          <StatCard label="Sem próxima atividade" value={central.opportunities_without_next_activity} icon={ListChecks} />
          <StatCard label="Oportunidades paradas" value={central.stalled_opportunities} icon={AlertCircle} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Minha agenda de hoje</h4>
            {agenda.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma atividade agendada para hoje.</p>
            ) : (
              <ul className="space-y-1">
                {agenda.map((a) => (
                  <li key={a.id} className="text-sm flex items-center justify-between border-b py-1">
                    <span><span className="font-mono text-xs mr-2">{fmtTime(a.scheduled_date)}</span>{a.title}</span>
                    <Badge variant="outline" className="text-xs">{a.type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Top ações do dia</h4>
            {nextActions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem ações sugeridas no momento.</p>
            ) : (
              <ul className="space-y-1">
                {nextActions.slice(0, 10).map((n, i) => (
                  <li key={i} className="text-sm border-b py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{n.title}</span>
                      <Badge variant="secondary" className="text-xs">P{n.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.action_label} · {n.customer_name ?? '—'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {(overdue.length > 0 || proposalsAction.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {overdue.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Follow ups atrasados</h4>
                <ul className="space-y-1">
                  {overdue.map((o) => (
                    <li key={o.id} className="text-sm border-b py-1">
                      <div className="flex justify-between">
                        <span>{o.title}</span>
                        <Badge variant="destructive" className="text-xs">{o.days_overdue}d</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{o.customer_name ?? '—'}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {proposalsAction.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Propostas que exigem ação</h4>
                <ul className="space-y-1">
                  {proposalsAction.map((p) => (
                    <li key={p.id} className="text-sm border-b py-1">
                      <div className="flex justify-between">
                        <span>{p.customer_name ?? p.title ?? '—'}</span>
                        <Badge variant="outline" className="text-xs">{p.reason}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
