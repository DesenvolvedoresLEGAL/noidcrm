import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import type { ForecastSellerPerformance, RecommendedActionType } from '@/types/forecast-seller';

interface Props {
  sellers: ForecastSellerPerformance[];
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function confidenceBadge(score: number) {
  if (score >= 80) return { label: 'Alta', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
  if (score >= 60) return { label: 'Moderada', className: 'bg-sky-500/15 text-sky-600 border-sky-500/30' };
  if (score >= 40) return { label: 'Baixa', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
  return { label: 'Crítica', className: 'bg-rose-500/15 text-rose-600 border-rose-500/30' };
}

const ACTION_LABELS: Record<RecommendedActionType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  configure_goal: { label: 'Configurar meta', variant: 'outline' },
  increase_pipeline: { label: 'Aumentar pipeline', variant: 'secondary' },
  recover_risk_deals: { label: 'Recuperar risco', variant: 'destructive' },
  reactivate_stale_deals: { label: 'Reativar deals', variant: 'secondary' },
  define_next_steps: { label: 'Definir próximo passo', variant: 'secondary' },
  maintain_execution: { label: 'Manter execução', variant: 'default' },
};

export function SellerPerformanceTable({ sellers }: Props) {
  const navigate = useNavigate();

  if (sellers.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Forecast por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 space-y-2">
            <p className="text-sm font-medium">Nenhum vendedor com oportunidades neste período.</p>
            <p className="text-xs text-muted-foreground">
              Assim que houver oportunidades abertas ou ganhas no período, o Forecast por Vendedor
              será calculado automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleAction = (s: ForecastSellerPerformance) => {
    const t = s.recommended_action_type;
    if (t === 'configure_goal') {
      navigate('/configuracoes/metas');
    } else if (t === 'recover_risk_deals') {
      navigate(`/forecast?tab=risks&seller=${s.seller_id}`);
    } else if (t === 'reactivate_stale_deals' || t === 'define_next_steps') {
      navigate(`/forecast?tab=deals&seller=${s.seller_id}`);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Forecast por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Fechado</TableHead>
                <TableHead className="text-right">Realista</TableHead>
                <TableHead className="text-right">Otimista</TableHead>
                <TableHead className="text-right">Melhor Caso</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead className="text-right">% Meta</TableHead>
                <TableHead className="text-right">Cobertura</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Risco</TableHead>
                <TableHead className="text-right">Slipping</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Ação Recomendada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((s) => {
                const conf = confidenceBadge(s.forecast_confidence);
                const action = ACTION_LABELS[s.recommended_action_type];
                const goalLabel = s.has_goal && s.monthly_goal != null
                  ? formatCurrencyFull(s.monthly_goal)
                  : 'Meta não configurada';
                const gapLabel =
                  !s.has_goal || s.gap_to_goal == null
                    ? '—'
                    : s.gap_to_goal <= 0
                    ? 'Meta superada'
                    : formatCurrencyFull(s.gap_to_goal);
                const attainmentLabel =
                  !s.has_goal || s.goal_attainment_percentage == null
                    ? '—'
                    : `${s.goal_attainment_percentage.toFixed(0)}%`;
                const coverageLabel =
                  !s.has_goal || s.coverage_ratio == null
                    ? '—'
                    : `${s.coverage_ratio.toFixed(1)}x`;

                return (
                  <TableRow key={s.seller_id}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={s.seller_avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {initials(s.seller_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{s.seller_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-right text-sm', !s.has_goal && 'text-muted-foreground italic')}>
                      {goalLabel}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatCurrencyFull(s.closed_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyFull(s.scenario_realistic)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyFull(s.scenario_optimistic)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyFull(s.scenario_best_case)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {gapLabel === '—' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : gapLabel === 'Meta superada' ? (
                        <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {gapLabel}
                        </span>
                      ) : (
                        <span className="text-rose-600 font-medium inline-flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {gapLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{attainmentLabel}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild><span>{coverageLabel}</span></TooltipTrigger>
                        <TooltipContent>Pipeline total ÷ Meta mensal</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {s.deals_count}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <div className="flex flex-col items-end leading-tight">
                        <span className={cn(s.risk_amount > 0 && 'text-rose-600 font-medium')}>
                          {formatCurrencyFull(s.risk_amount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {s.risk_deals_count} deal{s.risk_deals_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <div className="flex flex-col items-end leading-tight">
                        <span className={cn(s.slipping_amount > 0 && 'text-amber-600 font-medium')}>
                          {formatCurrencyFull(s.slipping_amount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {s.slipping_deals_count} deal{s.slipping_deals_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={cn('font-medium', conf.className)}>
                            {conf.label} · {Math.round(s.forecast_confidence)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>NRHS médio: {Math.round(s.nrhs_avg)}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleAction(s)}
                        title={s.recommended_action}
                      >
                        <Badge variant={action.variant} className="font-normal">
                          {action.label}
                        </Badge>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
