import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import type { CloserPaceData } from '@/types/dashboard/closer';
import { CloserPaceCard } from './CloserPaceCard';
import { CloserPaceStatusBadge } from './CloserPaceStatusBadge';
import { CloserPaceProgress } from './CloserPaceProgress';

const fmtBRL = (n: number | null | undefined) =>
  typeof n === 'number'
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

const copy: Record<string, string> = {
  'Acima do pace': 'Você está acima do ritmo necessário para bater a meta.',
  'No pace': 'Você está dentro do ritmo esperado para o mês.',
  Atrasado: 'Você precisa acelerar para recuperar o pace do mês.',
  Crítico: 'O ritmo atual não sustenta a meta. Priorize propostas quentes hoje.',
  'Meta não configurada':
    'Meta mensal não configurada. Cadastre a meta nas Configurações de Resultado.',
};

export function CloserPaceSection({ pace }: { pace?: CloserPaceData }) {
  if (!pace) return null;

  if (!pace.available) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">Pace Diário</CardTitle>
              <p className="text-xs text-muted-foreground">
                Ritmo necessário para bater a meta do mês.
              </p>
            </div>
            <CloserPaceStatusBadge status={pace.status} severity={pace.severity} />
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {pace.reason ?? copy['Meta não configurada']}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const gap = pace.pace_gap_value ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Pace Diário</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ritmo necessário para bater a meta do mês.
            </p>
          </div>
          <CloserPaceStatusBadge status={pace.status} severity={pace.severity} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{copy[pace.status]}</p>

        <div className="space-y-2">
          <CloserPaceProgress
            realized={pace.realized_value ?? 0}
            goal={pace.goal_value ?? 0}
            expectedToday={pace.expected_pace_today ?? 0}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fmtBRL(pace.realized_value)} realizado</span>
            <span>Meta {fmtBRL(pace.goal_value)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <CloserPaceCard label="Meta do mês" value={fmtBRL(pace.goal_value)} highlight />
          <CloserPaceCard label="Realizado" value={fmtBRL(pace.realized_value)} />
          <CloserPaceCard
            label="Pace esperado hoje"
            value={fmtBRL(pace.expected_pace_today)}
          />
          <CloserPaceCard
            label="Gap de pace"
            value={fmtBRL(gap)}
            hint={gap >= 0 ? 'Acima do ritmo' : 'Atrás do ritmo'}
          />
          <CloserPaceCard label="Falta para meta" value={fmtBRL(pace.remaining_to_goal)} />
          <CloserPaceCard
            label="Ritmo diário necessário"
            value={fmtBRL(pace.required_daily_rate)}
            hint={`${pace.business_days_remaining ?? 0} dias úteis restantes`}
          />
          <CloserPaceCard
            label="Média diária atual"
            value={fmtBRL(pace.current_daily_average)}
            hint={`${pace.business_days_elapsed ?? 0}/${pace.business_days_total ?? 0} dias úteis`}
          />
          <CloserPaceCard
            label="Atingimento da meta"
            value={`${pace.goal_attainment_percent ?? 0}%`}
            hint={`Pace: ${pace.pace_percent ?? 0}%`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
