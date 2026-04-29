import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { CloserPaceData } from '@/types/dashboard/closer';
import { CloserPaceCard } from './CloserPaceCard';
import { CloserPaceStatusBadge } from './CloserPaceStatusBadge';
import { CloserPaceProgress } from './CloserPaceProgress';

const fmtBRL = (n: number | null | undefined) =>
  typeof n === 'number'
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

const COPY: Record<string, string> = {
  'Acima do pace': 'Você está acima do ritmo necessário para bater a meta.',
  'No pace': 'Você está dentro do ritmo esperado para o mês.',
  Atrasado: 'Você precisa acelerar para recuperar o ritmo do mês.',
  Crítico: 'O ritmo atual não sustenta a meta. Priorize propostas quentes hoje.',
  'Meta não configurada':
    'Meta mensal não configurada. Cadastre a meta nas Configurações de Resultado.',
};

function PaceTitle({ rule }: { rule?: string }) {
  return (
    <div className="flex items-center gap-2">
      <CardTitle className="text-base">Pace Diário</CardTitle>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Como o pace é calculado"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              {rule ?? 'Cálculo baseado em dias úteis de segunda a sexta, sem feriados nesta versão.'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function CloserPaceSection({ pace }: { pace?: CloserPaceData }) {
  if (!pace) return null;

  if (!pace.available) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <PaceTitle rule={pace.business_days_rule} />
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
              {pace.reason ?? COPY['Meta não configurada']}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const goal = pace.goal_value ?? 0;
  const realized = pace.realized_value ?? 0;
  const expectedToday = pace.expected_pace_today ?? 0;
  const businessDaysTotal = pace.business_days_total ?? 0;
  const businessDaysRemaining = pace.business_days_remaining ?? 0;

  // Proteções explícitas
  const hasGoal = goal > 0;
  const hasBusinessDays = businessDaysTotal > 0;
  const overshoot = realized > goal && goal > 0;

  const gap = hasGoal ? realized - expectedToday : 0;
  const remaining = hasGoal ? Math.max(0, goal - realized) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <PaceTitle rule={pace.business_days_rule} />
            <p className="text-xs text-muted-foreground">
              Ritmo necessário para bater a meta do mês.
            </p>
          </div>
          <CloserPaceStatusBadge status={pace.status} severity={pace.severity} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{COPY[pace.status]}</p>

        {!hasBusinessDays && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Sem dias úteis no período. Cálculo de pace pode estar limitado.
            </AlertDescription>
          </Alert>
        )}

        {overshoot && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Realizado superou a meta — pace exibido como atingido.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <CloserPaceProgress realized={realized} goal={goal} expectedToday={expectedToday} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fmtBRL(realized)} realizado</span>
            <span>Meta {fmtBRL(goal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <CloserPaceCard label="Meta do mês" value={fmtBRL(goal)} highlight />
          <CloserPaceCard label="Realizado" value={fmtBRL(realized)} />
          <CloserPaceCard label="Pace esperado hoje" value={fmtBRL(expectedToday)} />
          <CloserPaceCard
            label="Gap de pace"
            value={fmtBRL(gap)}
            hint={gap >= 0 ? 'Acima do ritmo' : 'Atrás do ritmo'}
          />
          <CloserPaceCard label="Falta para meta" value={fmtBRL(remaining)} />
          <CloserPaceCard
            label="Ritmo diário necessário"
            value={fmtBRL(pace.required_daily_rate)}
            hint={`${businessDaysRemaining} dias úteis restantes`}
          />
          <CloserPaceCard
            label="Média diária atual"
            value={fmtBRL(pace.current_daily_average)}
            hint={`${pace.business_days_elapsed ?? 0}/${businessDaysTotal} dias úteis`}
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
