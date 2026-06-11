import { Users, Trophy, Target, Flame, AlertTriangle, PieChart } from 'lucide-react';
import { PeopleSignalCard } from './PeopleSignalCard';
import type { PeopleScoreboard } from '@/hooks/revenue-command/useRevenuePeople';

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function PeopleExecutiveScoreboard({ scoreboard }: { scoreboard: PeopleScoreboard }) {
  const top1Pct = scoreboard.concentrationTop1Pct;
  const concTone: 'default' | 'warning' | 'critical' =
    top1Pct === null ? 'default' : top1Pct > 85 ? 'critical' : top1Pct > 70 ? 'warning' : 'default';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <PeopleSignalCard
        label="Pessoas ativas"
        value={String(scoreboard.activePeople)}
        helper="No período"
        icon={Users}
      />
      <PeopleSignalCard
        label="Top performer"
        value={scoreboard.topPerformer?.name ?? '—'}
        helper={scoreboard.topPerformer ? fmtBRL(scoreboard.topPerformer.value) : 'Sem receita válida'}
        icon={Trophy}
        tone={scoreboard.topPerformer ? 'positive' : 'default'}
      />
      <PeopleSignalCard
        label="Maior conversão"
        value={scoreboard.bestConverter?.name ?? '—'}
        helper={
          scoreboard.bestConverter
            ? `Win Rate ${scoreboard.bestConverter.pct.toFixed(0)}%`
            : 'Sem amostra suficiente'
        }
        icon={Target}
      />
      <PeopleSignalCard
        label="Maior volume SQLs"
        value={scoreboard.topSqlVolume?.name ?? '—'}
        helper={
          scoreboard.topSqlVolume
            ? `${scoreboard.topSqlVolume.count} SQLs qualificados`
            : 'Sem dados'
        }
        icon={Flame}
      />
      <PeopleSignalCard
        label="Maior risco qualidade"
        value={scoreboard.worstQuality?.name ?? '—'}
        helper={
          scoreboard.worstQuality
            ? `SQL→Proposta ${scoreboard.worstQuality.pct.toFixed(0)}%`
            : 'Sem dados'
        }
        icon={AlertTriangle}
        tone={scoreboard.worstQuality ? 'warning' : 'default'}
      />
      <PeopleSignalCard
        label="Concentração no top 1"
        value={top1Pct !== null ? `${top1Pct.toFixed(0)}%` : '—'}
        helper={top1Pct !== null ? 'da receita válida' : 'Sem receita no período'}
        icon={PieChart}
        tone={concTone}
      />
    </div>
  );
}
