import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Sparkles, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus,
  Target, AlertCircle, ShieldCheck, Users, Flame, LifeBuoy, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastIntelligence } from '@/hooks/forecast/useForecastIntelligence';
import type {
  ConfidenceLevel, ForecastPosition, AdjustmentType, SignalSeverity, SignalImpact,
} from '@/types/forecast-intelligence';
import { cn } from '@/lib/utils';

interface Props {
  periodStart: Date;
  periodEnd: Date;
  pipelineId?: string;
  sellerId?: string | null;
}

function fmtBRL(v: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(v) || 0);
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'Alta', moderate: 'Moderada', low: 'Baixa', critical: 'Crítica',
};
const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  moderate: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  low: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const POSITION_LABEL: Record<ForecastPosition, string> = {
  above_goal_secure: 'Acima da meta — seguro',
  above_goal_risky: 'Acima da meta — com risco',
  near_goal: 'Próximo da meta',
  below_goal_recoverable: 'Abaixo — recuperável',
  below_goal_critical: 'Abaixo — crítico',
  no_goal_configured: 'Sem meta',
};

const REC_LABEL: Record<AdjustmentType, string> = {
  maintain: 'Manter',
  reduce: 'Reduzir',
  increase_with_caution: 'Aumentar com cautela',
  manual_review: 'Revisão manual',
  no_goal: 'Meta ausente',
};

function severityClass(s?: SignalSeverity | SignalImpact) {
  switch (s) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'low': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export function ForecastIntelligencePanel({ periodStart, periodEnd, pipelineId, sellerId }: Props) {
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const { intelligence, isLoading, error, refetch, isFetching } = useForecastIntelligence({
    organizationId: orgId,
    pipelineId: pipelineId ?? null,
    periodStart: format(periodStart, 'yyyy-MM-dd'),
    periodEnd: format(periodEnd, 'yyyy-MM-dd'),
    sellerId: sellerId ?? null,
    enabled: Boolean(orgId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="default" className="border-amber-500/30 bg-amber-500/5">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle>Não foi possível carregar a inteligência do Forecast agora.</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          Os demais dados do módulo continuam disponíveis.{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>Tentar novamente</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const i = intelligence;
  const hasAnyData = i && (i.metadata.has_run || i.metadata.snapshots_count > 0);

  if (!i || !hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Inteligência em formação
          </CardTitle>
          <CardDescription>
            O HUMANOID precisa de cálculo de forecast, snapshots ou oportunidades no período para gerar
            diagnóstico executivo.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const lowSample = i.metadata.snapshots_count < 5;
  const m = i.metadata;
  const r = i.forecast_adjustment_recommendation;

  return (
    <div className="space-y-4">
      {/* Bloco 1 — Resumo Executivo */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                HUMANOID Forecast Intelligence
              </CardTitle>
              <CardDescription className="mt-1">{i.executive_summary}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={cn('border', CONFIDENCE_CLASS[i.confidence_level])}>
                Confiança {CONFIDENCE_LABEL[i.confidence_level]} · {Math.round(i.confidence_score)}
              </Badge>
              <Badge variant="outline">{POSITION_LABEL[i.forecast_position]}</Badge>
              <Badge variant="secondary">{REC_LABEL[r.type]}</Badge>
              {lowSample && (
                <Badge className="border bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Baixa amostra histórica
                </Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isFetching && 'animate-spin')} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Realista</div>
              <div className="font-semibold">{fmtBRL(m.scenario_realistic)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Meta</div>
              <div className="font-semibold">{m.monthly_goal ? fmtBRL(m.monthly_goal) : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Fechado</div>
              <div className="font-semibold">{fmtBRL(m.closed_amount)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Pipeline</div>
              <div className="font-semibold">{fmtBRL(m.pipeline_total)}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Gerado em {format(new Date(m.generated_at), 'dd/MM/yyyy HH:mm')} · v{m.calculation_version} ·{' '}
            {m.snapshots_count} snapshots · bias: {m.bias_direction} · tendência: {m.forecast_trend}
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Recomendação de Ajuste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Recomendação sobre o Forecast Realista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Forecast atual</div>
              <div className="text-lg font-semibold">{fmtBRL(r.current_realistic)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recomendado</div>
              <div className="text-lg font-semibold">{fmtBRL(r.recommended_realistic)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Ajuste sugerido</div>
              <div className={cn(
                'text-lg font-semibold flex items-center gap-1',
                r.adjustment_amount < 0 ? 'text-red-600' : r.adjustment_amount > 0 ? 'text-emerald-600' : 'text-muted-foreground'
              )}>
                {r.adjustment_amount < 0 ? <TrendingDown className="h-4 w-4" /> :
                  r.adjustment_amount > 0 ? <TrendingUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                {fmtBRL(r.adjustment_amount)} ({r.adjustment_percentage}%)
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tipo</div>
              <Badge variant="outline" className="mt-1">{REC_LABEL[r.type]}</Badge>
            </div>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">{r.reason}</div>
        </CardContent>
      </Card>

      {/* Blocos 3 & 4 — Sinais positivos x risco */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              O que está sustentando o Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {i.positive_signals.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum sinal positivo relevante identificado.</p>
            )}
            {i.positive_signals.map((s, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 text-sm border rounded-md p-2">
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.value}</div>
                </div>
                <Badge variant="outline" className={cn('border', severityClass(s.impact))}>{s.impact ?? 'low'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              O que está contaminando o Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {i.risk_signals.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum sinal de risco identificado.</p>
            )}
            {i.risk_signals.map((s, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 text-sm border rounded-md p-2">
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.value}</div>
                </div>
                <Badge variant="outline" className={cn('border', severityClass(s.severity))}>{s.severity ?? 'low'}</Badge>
              </div>
            ))}
            {i.contaminated_forecast.amount > 0 && (
              <div className="mt-3 border-t pt-3 text-xs space-y-1">
                <div className="font-medium">
                  Contaminação total: {fmtBRL(i.contaminated_forecast.amount)} · {i.contaminated_forecast.deals_count} deals
                </div>
                {i.contaminated_forecast.reasons.map((r, idx) => (
                  <div key={idx} className="text-muted-foreground">• {r}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bloco 5 — Ações 24h */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-600" />
            Ações das próximas 24h
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {i.priority_actions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma ação prioritária para o período.</p>
          )}
          {i.priority_actions.map((a, idx) => (
            <div key={idx} className="border rounded-md p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{a.title}</div>
                <Badge variant="outline" className={cn('border', severityClass(a.priority))}>{a.priority}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
              <div className="flex gap-4 mt-2 text-xs">
                {a.estimated_recovered_amount > 0 && (
                  <span><span className="text-muted-foreground">Recuperável:</span> {fmtBRL(a.estimated_recovered_amount)}</span>
                )}
                {a.related_deals_count > 0 && (
                  <span><span className="text-muted-foreground">Deals:</span> {a.related_deals_count}</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bloco 6 — Decisões do gestor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Decisões do gestor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {i.manager_decisions.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem decisões pendentes neste momento.</p>
          )}
          {i.manager_decisions.map((d, idx) => (
            <div key={idx} className="border rounded-md p-3 text-sm space-y-1">
              <div className="font-medium">{d.question}</div>
              <div className="text-xs text-muted-foreground">{d.context}</div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary">Sugestão: {d.suggested_decision}</Badge>
                {d.financial_impact !== 0 && (
                  <Badge variant="outline">Impacto: {fmtBRL(d.financial_impact)}</Badge>
                )}
                <Badge variant="outline" className={cn('border', severityClass(d.urgency))}>{d.urgency}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bloco 7 — Alertas por vendedor */}
      {i.seller_alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Alertas por vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Alerta</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {i.seller_alerts.map((a, idx) => (
                    <TableRow key={`${a.seller_id}-${a.alert_type}-${idx}`}>
                      <TableCell className="font-medium">{a.seller_name ?? '—'}</TableCell>
                      <TableCell>{a.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('border', severityClass(a.severity))}>{a.severity}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(a.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bloco 8 — Top deals em risco × recuperáveis */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Top Deals em Risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {i.top_risky_deals.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem deals em risco no período.</p>
            )}
            {i.top_risky_deals.map((d) => (
              <button
                key={d.opportunity_id}
                onClick={() => navigate(`/opportunities/${d.opportunity_id}`)}
                className="w-full text-left border rounded-md p-2 text-sm hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.deal_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.company_name ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtBRL(d.deal_value)}</div>
                    <div className="text-xs text-muted-foreground">{d.forecast_bucket} · {d.risk_level ?? '—'}</div>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="h-4 w-4 text-emerald-600" />
              Top Deals para Recuperar o Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {i.top_recovery_deals.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem deals recuperáveis identificados.</p>
            )}
            {i.top_recovery_deals.map((d) => (
              <button
                key={d.opportunity_id}
                onClick={() => navigate(`/opportunities/${d.opportunity_id}`)}
                className="w-full text-left border rounded-md p-2 text-sm hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.deal_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.company_name ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtBRL(d.deal_value)}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.forecast_bucket}{d.nrhs_score != null ? ` · NRHS ${Math.round(d.nrhs_score)}` : ''}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
