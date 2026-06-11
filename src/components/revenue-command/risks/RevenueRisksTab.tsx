import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenueSectionCard } from '@/components/revenue-command/RevenueSectionCard';
import {
  useRevenueRisks,
  type RiskBlock,
  type RiskLevel,
  type RecommendedRiskAction,
} from '@/hooks/revenue-command/useRevenueRisks';

const LEVEL_DOT: Record<RiskLevel, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-rose-500',
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
};

const LEVEL_BADGE: Record<RiskLevel, string> = {
  low: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function RiskCard({ block }: { block: RiskBlock }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${LEVEL_DOT[block.level]}`} />
              <h3 className="text-sm font-semibold leading-tight">{block.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{block.question}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 text-[10px] ${LEVEL_BADGE[block.level]}`}>
            {LEVEL_LABEL[block.level]}
          </Badge>
        </div>

        {block.metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {block.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-md border bg-muted/30 px-2 py-1.5"
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </div>
                <div className="text-sm font-semibold tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium">{block.status}</p>
          <p className="text-xs text-muted-foreground">{block.diagnosis}</p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-[11px] text-muted-foreground">
            {block.available ? (
              <>
                Impacto:{' '}
                <span className="font-semibold text-foreground">
                  {block.impactValue > 0 ? fmtBRL(block.impactValue) : '—'}
                </span>
                {block.impactHelper && (
                  <span className="ml-1 text-muted-foreground">· {block.impactHelper}</span>
                )}
              </>
            ) : (
              <span>Fonte indisponível no momento.</span>
            )}
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to={block.cta.to}>
              {block.cta.label}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingPanel({ ranking }: { ranking: RiskBlock[] }) {
  if (ranking.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum risco relevante detectado no período.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {ranking.map((b, idx) => (
        <li
          key={b.id}
          className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <span className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[b.level]}`} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{b.title}</p>
              <p className="truncate text-xs text-muted-foreground">{b.status}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {b.impactValue > 0 ? fmtBRL(b.impactValue) : '—'}
            </div>
            <Badge variant="outline" className={`text-[10px] ${LEVEL_BADGE[b.level]}`}>
              {LEVEL_LABEL[b.level]}
            </Badge>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActionsPanel({
  actions,
}: {
  actions: ReturnType<typeof useRevenueRisks>['data'] extends infer T
    ? T extends { actions: infer A }
      ? A
      : never
    : never;
}) {
  if (!actions || actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem ações prioritárias no momento.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {actions.map((a) => (
        <li
          key={a.id}
          className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
        >
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  a.priority === 'alta'
                    ? LEVEL_BADGE.high
                    : a.priority === 'média'
                      ? LEVEL_BADGE.medium
                      : LEVEL_BADGE.low
                }`}
              >
                {a.priority}
              </Badge>
              <p className="truncate text-sm font-medium">{a.title}</p>
            </div>
            <p className="text-xs text-muted-foreground">{a.reason}</p>
            {a.impactValue > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Impacto estimado:{' '}
                <span className="font-semibold text-foreground">
                  {fmtBRL(a.impactValue)}
                </span>
              </p>
            )}
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to={a.to}>
              {a.ctaLabel}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function RevenueRisksTab() {
  const { data, isLoading } = useRevenueRisks();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Riscos</h2>
          <p className="text-sm text-muted-foreground">
            Onde a meta pode morrer antes de morrer — priorizado por impacto.
          </p>
        </div>
        {data?.scope && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            title={
              data.scope.resolved
                ? `Pipeline: ${data.scope.pipelineName ?? '—'}`
                : 'Pipeline comercial não configurado'
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Escopo: {data.scope.label}
            {data.scope.pipelineName && (
              <span className="text-muted-foreground/70">· {data.scope.pipelineName}</span>
            )}
          </span>
        )}
      </header>

      {data && !data.scope.resolved && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Pipeline comercial não configurado</AlertTitle>
          <AlertDescription className="text-xs">
            Defina o pipeline oficial de Vendas em Configurações &gt; Forecast para que o
            Revenue Command Center calcule os riscos no escopo correto.
          </AlertDescription>
        </Alert>
      )}

      {data?.meta.partial && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Dados parciais</AlertTitle>
          <AlertDescription className="text-xs">
            Parte dos dados não pôde ser carregada
            {data.meta.failedSources.length > 0
              ? ` (${data.meta.failedSources.join(', ')})`
              : ''}
            . A leitura abaixo reflete apenas as fontes disponíveis.
          </AlertDescription>
        </Alert>
      )}

      <RevenueSectionCard
        title="Top riscos da operação"
        description="Ordenado por nível e impacto financeiro estimado."
        icon={AlertTriangle}
      >
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <RankingPanel ranking={data.ranking} />
        )}
      </RevenueSectionCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading || !data
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48" />)
          : data.blocks.map((b) => <RiskCard key={b.id} block={b} />)}
      </div>

      <RevenueSectionCard
        title="Ações recomendadas"
        description="Sugestões derivadas dos riscos detectados."
        icon={Sparkles}
      >
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <ActionsPanel actions={data.actions} />
        )}
      </RevenueSectionCard>

      {data && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Dados consolidados a partir de {data.meta.sources.join(', ')}.
        </p>
      )}
    </div>
  );
}
