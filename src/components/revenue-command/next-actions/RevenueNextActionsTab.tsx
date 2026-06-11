/**
 * Sprint RCC V3.7 — Aba "Próximas Ações".
 * Fila executiva priorizada. Não cria/edita dados.
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ListChecks,
  Sparkles,
  Target,
  Zap,
  Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useRevenueNextActions,
  type NextAction,
  type NextActionPriority,
  type NextActionCategory,
} from '@/hooks/revenue-command/useRevenueNextActions';

const PRIORITY_LABEL: Record<NextActionPriority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const PRIORITY_BADGE: Record<NextActionPriority, string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  high: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  medium: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  low: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

const PRIORITY_DOT: Record<NextActionPriority, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-sky-500',
  low: 'bg-muted-foreground/50',
};

const CONFIDENCE_LABEL = { high: 'Alta', medium: 'Média', low: 'Baixa' } as const;

const CATEGORY_LABEL: Record<NextActionCategory, string> = {
  forecast: 'Forecast',
  pipeline: 'Pipeline',
  quality: 'Qualidade',
  audit: 'Auditoria',
  win_loss: 'Win/Loss',
  people: 'Pessoas',
  health: 'Higiene',
  today: 'Hoje',
};

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'critical', label: 'Críticas' },
  { key: 'high', label: 'Alta prioridade' },
  { key: 'forecast', label: 'Forecast' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'quality', label: 'Qualidade' },
  { key: 'audit', label: 'Auditoria' },
  { key: 'win_loss', label: 'Win/Loss' },
  { key: 'health', label: 'Higiene' },
];

const SORTS = [
  { key: 'impact', label: 'Impacto' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'confidence', label: 'Confiança' },
] as const;

function PriorityBadge({ priority }: { priority: NextActionPriority }) {
  return (
    <Badge variant="outline" className={cn('shrink-0 text-[10px]', PRIORITY_BADGE[priority])}>
      <span className={cn('mr-1 h-1.5 w-1.5 rounded-full', PRIORITY_DOT[priority])} />
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={action.priority} />
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {CATEGORY_LABEL[action.category]}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Confiança: {CONFIDENCE_LABEL[action.confidence]}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold leading-tight">{action.title}</h3>
            <p className="text-xs text-muted-foreground">{action.reason}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Impacto
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {action.impactLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-[11px] text-muted-foreground">
            Origem: <span className="font-medium text-foreground/80">{action.source}</span>
          </div>
          <div className="flex gap-2">
            {action.secondaryCta && (
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link to={action.secondaryCta.href}>{action.secondaryCta.label}</Link>
              </Button>
            )}
            <Button asChild size="sm" className="h-7 gap-1 text-xs">
              <Link to={action.primaryCta.href}>
                {action.primaryCta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryKpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'critical' | 'high' | 'good' | 'neutral';
}) {
  const toneClass =
    tone === 'critical'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'high'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'good'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-foreground';
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className={cn('text-xl font-semibold tabular-nums', toneClass)}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function RevenueNextActionsTab() {
  const { data, isLoading } = useRevenueNextActions();
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('priority');

  const filtered = useMemo(() => {
    const list = data?.actions ?? [];
    const byFilter = list.filter((a) => {
      if (filter === 'all') return true;
      if (filter === 'critical') return a.priority === 'critical';
      if (filter === 'high') return a.priority === 'high';
      return a.category === filter;
    });
    const order: Record<NextActionPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const confOrder = { high: 3, medium: 2, low: 1 } as const;
    return [...byFilter].sort((a, b) => {
      if (sort === 'impact') return (b.impactAmount ?? 0) - (a.impactAmount ?? 0);
      if (sort === 'confidence') return confOrder[b.confidence] - confOrder[a.confidence];
      return order[b.priority] - order[a.priority] || b.priorityScore - a.priorityScore;
    });
  }, [data, filter, sort]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar as ações no momento.
        </CardContent>
      </Card>
    );
  }

  const { summary, meta } = data;
  const headline =
    summary.totalActions === 0
      ? 'Nenhuma ação crítica encontrada agora.'
      : `Hoje existem ${summary.totalActions} ações recomendadas com impacto estimado de ${fmtBRL(summary.estimatedImpact)}.`;

  return (
    <div className="space-y-4">
      {/* Executive summary */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">{headline}</p>
              {summary.totalActions === 0 && (
                <p className="text-xs text-muted-foreground">
                  Continue monitorando Forecast, Pipeline Health e Riscos.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <SummaryKpi
              icon={AlertTriangle}
              label="Ações críticas"
              value={String(summary.criticalCount)}
              tone={summary.criticalCount > 0 ? 'critical' : 'good'}
            />
            <SummaryKpi
              icon={Target}
              label="Alta prioridade"
              value={String(summary.highCount)}
              tone={summary.highCount > 0 ? 'high' : 'neutral'}
            />
            <SummaryKpi
              icon={Zap}
              label="Impacto estimado"
              value={fmtBRL(summary.estimatedImpact)}
            />
            <SummaryKpi
              icon={Shield}
              label="Receita protegida"
              value={fmtBRL(summary.protectedRevenue)}
              tone="good"
            />
            <SummaryKpi
              icon={ArrowRight}
              label="Receita acelerável"
              value={fmtBRL(summary.acceleratableRevenue)}
            />
            <SummaryKpi
              icon={CheckCircle2}
              label="Confiança"
              value={meta.confidence === 'high' ? 'Alta' : meta.confidence === 'medium' ? 'Média' : 'Baixa'}
              tone={meta.confidence === 'high' ? 'good' : meta.confidence === 'medium' ? 'high' : 'critical'}
            />
          </div>
        </CardContent>
      </Card>

      {meta.partialSources.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dados parciais</AlertTitle>
          <AlertDescription>
            As seguintes fontes falharam e algumas ações podem não aparecer: {meta.partialSources.join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Ordenar:</span>
          {SORTS.map((s) => (
            <Button
              key={s.key}
              variant={sort === s.key ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <ListChecks className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma ação para o filtro selecionado.</p>
            <p className="text-xs text-muted-foreground">
              Ajuste os filtros ou continue monitorando os sinais do Revenue Command.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((a) => (
            <NextActionCard key={a.id} action={a} />
          ))}
        </div>
      )}
    </div>
  );
}
