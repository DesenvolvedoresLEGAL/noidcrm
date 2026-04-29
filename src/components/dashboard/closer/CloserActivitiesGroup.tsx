import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CloserSectionList } from './CloserSectionList';
import type { CloserListItem } from '@/types/dashboard/closer';

interface Props {
  todayAgenda: CloserListItem[];
  overdueFollowups: CloserListItem[];
  withoutNextActivity: CloserListItem[];
}

export function CloserActivitiesGroup({
  todayAgenda,
  overdueFollowups,
  withoutNextActivity,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Follow ups e atividades</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sua agenda do dia, pendências em aberto e oportunidades sem próximo passo.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-3">
          <CloserSectionList
            title="Agenda de hoje"
            items={todayAgenda}
            emptyText="Nenhuma atividade agendada para hoje."
            showValue={false}
          />
          <CloserSectionList
            title="Follow ups vencidos"
            items={overdueFollowups}
            emptyText="Nenhum follow up vencido. Boa."
            showValue={false}
          />
          <CloserSectionList
            title="Oportunidades sem próxima atividade"
            items={withoutNextActivity}
            emptyText="Todas as oportunidades têm próxima atividade."
          />
        </div>
      </CardContent>
    </Card>
  );
}
