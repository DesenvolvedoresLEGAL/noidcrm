import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  HeartPulse,
  TrendingDown,
  Users,
  Wallet,
  Activity,
  Sparkles,
  ShieldAlert,
  Calendar,
  Copy,
  Building2,
  UserX,
  Banknote,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  useRevenuePipelineHealth,
  type CriticalIssue,
  type HygieneRanking as HygieneRankingRow,
  type PipelineIssueId,
  type RecommendedAction,
  type StageHealth,
} from '@/hooks/revenue-command/useRevenuePipelineHealth';
import { RevenueSectionCard } from '../RevenueSectionCard';

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

const ISSUE_ICONS: Record<PipelineIssueId, React.ComponentType<{ className?: string }>> = {
  no_owner: UserX,
  no_value: Banknote,
  no_next_activity: Activity,
  stale: AlertTriangle,
  overdue: Calendar,
  duplicate: Copy,
  no_account: Building2,
  no_contact: Users,
};

const TRUST_COLOR: Record<string, string> = {
  Excelente: 'text-emerald-500',
  Confiável: 'text-emerald-500',
  Atenção: 'text-amber-500',
  Crítico: 'text-red-500',
};

const STAGE_COLOR = {
  green: 'text-emerald-500',
  yellow: 'text-amber-500',
  red: 'text-red-500',
} as const;

const PRIORITY_STYLES: Record<RecommendedAction['priority'], string> = {
  high: 'border-red-500/50 bg-red-500/5',
  medium: 'border-amber-500/50 bg-amber-500/5',
  low: 'border-border bg-muted/30',
};

const PRIORITY_LABEL: Record<RecommendedAction['priority'], string> = {
  high: 'Prioridade Alta',
  medium: 'Prioridade Média',
  low: 'Prioridade Baixa',
};

function pipelineLink(issue?: PipelineIssueId) {
  // O Pipeline já possui filtros internos; encaminhamos com hint via querystring.
  return issue ? `/app/pipeline?healthIssue=${issue}` : '/app/pipeline';
}

export function RevenuePipelineHealthTab() {
  const { data, isLoading } = useRevenuePipelineHealth();
  const [selected, setSelected] = useState<CriticalIssue | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Pipeline Health</h2>
          <p className="text-sm text-muted-foreground">
            Posso confiar neste pipeline para tomar decisões?
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
              <span className="text-muted-foreground/70">
                · {data.scope.pipelineName}
              </span>
            )}
          </span>
        )}
      </header>

      {data && !data.scope.resolved && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">
            Pipeline comercial não configurado
          </AlertTitle>
          <AlertDescription className="text-xs">
            Defina o pipeline oficial de Vendas em Configurações &gt; Forecast
            para habilitar o Pipeline Health.
          </AlertDescription>
        </Alert>
      )}

      {/* Bloco 1 + 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TrustScoreCard data={data} loading={isLoading} />
        <DiagnosisCard text={data?.diagnosis ?? ''} loading={isLoading} />
      </div>

      {/* Bloco 3 — Problemas críticos */}
      <RevenueSectionCard
        title="Problemas críticos"
        description="Clique em um card para ver as oportunidades afetadas."
        icon={ShieldAlert}
      >
        <CriticalIssuesGrid
          issues={data?.issues ?? []}
          loading={isLoading}
          onPick={setSelected}
        />
      </RevenueSectionCard>

      {/* Bloco 4 — Dinheiro em risco */}
      <RevenueSectionCard
        title="Dinheiro em risco"
        description="Valor de oportunidades abertas com pendência operacional."
        icon={Wallet}
      >
        <MoneyAtRiskGrid data={data} loading={isLoading} />
      </RevenueSectionCard>

      {/* Bloco 5 + 6 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueSectionCard
          title="Saúde por etapa"
          description="Coloração baseada na idade média da etapa."
          icon={HeartPulse}
        >
          <StageHealthTable stages={data?.stages ?? []} loading={isLoading} />
        </RevenueSectionCard>

        <RevenueSectionCard
          title="Ranking de higiene"
          description="Quem cuida bem do CRM."
          icon={Trophy}
        >
          <HygieneRanking
            rows={data?.ranking ?? []}
            loading={isLoading}
          />
        </RevenueSectionCard>
      </div>

      {/* Bloco 7 — Ações recomendadas */}
      <RevenueSectionCard
        title="Ações recomendadas"
        description="Ordenadas pelo impacto estimado."
        icon={Sparkles}
      >
        <RecommendedActions
          actions={data?.actions ?? []}
          loading={isLoading}
        />
      </RevenueSectionCard>

      {/* Drawer/modal simples: lista das oportunidades selecionadas */}
      {selected && (
        <IssueDrillCard issue={selected} onClose={() => setSelected(null)} />
      )}

      {data && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          {data.totalOpen} oportunidades abertas no Pipeline de Vendas — sem
          alterar Forecast, Auditoria ou Win/Loss.
        </p>
      )}
    </div>
  );
}

/* ───────── Subcomponents ───────── */

function TrustScoreCard({
  data,
  loading,
}: {
  data: ReturnType<typeof useRevenuePipelineHealth>['data'];
  loading: boolean;
}) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">
          CRM Trust Score
        </CardDescription>
        <CardTitle className="flex items-baseline gap-2">
          {loading || !data ? (
            <Skeleton className="h-10 w-28" />
          ) : (
            <>
              <span className="text-4xl font-bold tabular-nums">
                {data.trustScore}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading || !data ? (
          <Skeleton className="h-3 w-32" />
        ) : (
          <>
            <span
              className={`text-sm font-semibold ${TRUST_COLOR[data.trustLabel]}`}
            >
              {data.trustLabel}
            </span>
            <Progress
              value={data.trustScore}
              className={`h-2 ${
                data.trustScore >= 80
                  ? '[&>div]:bg-emerald-500'
                  : data.trustScore >= 70
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-red-500'
              }`}
            />
            <p className="text-[11px] text-muted-foreground">
              {data.totalOpen} oportunidades abertas ·{' '}
              {fmtBRL(data.totalOpenValue)} em pipeline
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DiagnosisCard({ text, loading }: { text: string; loading: boolean }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-primary" />
          Diagnóstico executivo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {text}
          </pre>
        )}
        <p className="pt-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Gerado a partir dos dados oficiais — sem IA.
        </p>
      </CardContent>
    </Card>
  );
}

function CriticalIssuesGrid({
  issues,
  loading,
  onPick,
}: {
  issues: CriticalIssue[];
  loading: boolean;
  onPick: (i: CriticalIssue) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {issues.map((issue) => {
        const Icon = ISSUE_ICONS[issue.id];
        const empty = issue.count === 0;
        return (
          <button
            key={issue.id}
            type="button"
            onClick={() => !empty && onPick(issue)}
            disabled={empty}
            className={`group rounded-lg border bg-card p-3 text-left transition-colors ${
              empty
                ? 'opacity-60'
                : 'hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {issue.label}
              </span>
              {!empty && (
                <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{issue.count}</span>
              {issue.value > 0 && (
                <span className="text-xs text-muted-foreground">
                  · {fmtBRL(issue.value)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MoneyAtRiskGrid({
  data,
  loading,
}: {
  data: ReturnType<typeof useRevenuePipelineHealth>['data'];
  loading: boolean;
}) {
  const items = [
    {
      id: 'noActivity',
      label: 'Em oportunidades sem atividade',
      value: data?.moneyAtRisk.noActivityValue ?? 0,
      icon: Activity,
    },
    {
      id: 'overdue',
      label: 'Em oportunidades vencidas',
      value: data?.moneyAtRisk.overdueValue ?? 0,
      icon: Calendar,
    },
    {
      id: 'stale',
      label: 'Em oportunidades paradas',
      value: data?.moneyAtRisk.staleValue ?? 0,
      icon: TrendingDown,
    },
  ];
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map(({ id, label, value, icon: Icon }) => (
        <Card key={id} className="border-dashed">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <p className="text-xl font-semibold tabular-nums">
              {fmtBRL(value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StageHealthTable({
  stages,
  loading,
}: {
  stages: StageHealth[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (stages.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma oportunidade aberta no pipeline.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 text-left font-medium">Etapa</th>
            <th className="py-2 text-right font-medium">Qtd</th>
            <th className="py-2 text-right font-medium">Valor</th>
            <th className="py-2 text-right font-medium">Idade média</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.stageId} className="border-b last:border-0">
              <td className="py-2">
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${
                    s.health === 'green'
                      ? 'bg-emerald-500'
                      : s.health === 'yellow'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
                {s.stageName}
              </td>
              <td className="py-2 text-right tabular-nums">{s.count}</td>
              <td className="py-2 text-right tabular-nums">
                {fmtBRL(s.value)}
              </td>
              <td
                className={`py-2 text-right tabular-nums ${STAGE_COLOR[s.health]}`}
              >
                {s.avgAgeDays.toFixed(0)} d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HygieneRanking({
  rows,
  loading,
}: {
  rows: ReturnType<typeof useRevenuePipelineHealth>['data'] extends infer T
    ? T extends { ranking: infer R }
      ? R
      : never
    : never;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem owners atribuídos.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r, idx) => (
        <li
          key={r.ownerId}
          className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2"
        >
          <span className="w-5 text-center text-xs font-bold text-muted-foreground">
            {idx + 1}
          </span>
          <Avatar className="h-7 w-7">
            <AvatarImage src={r.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {r.ownerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.ownerName}</p>
            <p className="text-[11px] text-muted-foreground">
              {r.total} oportunidades · {r.issues} com pendência
            </p>
          </div>
          <Badge
            variant="secondary"
            className={
              r.score >= 80
                ? 'bg-emerald-500/10 text-emerald-600'
                : r.score >= 70
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-red-500/10 text-red-600'
            }
          >
            {r.score}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function RecommendedActions({
  actions,
  loading,
}: {
  actions: RecommendedAction[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (actions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem ações recomendadas no momento.
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      {actions.map((a) => (
        <Card key={a.id} className={`border ${PRIORITY_STYLES[a.priority]}`}>
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {PRIORITY_LABEL[a.priority]}
              </p>
              <p className="text-sm font-medium">{a.title}</p>
              {a.impactValue > 0 && (
                <p className="text-xs text-muted-foreground">
                  Impacto estimado: {fmtBRL(a.impactValue)}
                </p>
              )}
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={pipelineLink(a.filterIssue)}>
                Ver oportunidades
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IssueDrillCard({
  issue,
  onClose,
}: {
  issue: CriticalIssue;
  onClose: () => void;
}) {
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">
            {issue.label} · {issue.count} oportunidade(s)
          </CardTitle>
          <CardDescription className="text-xs">
            Total impactado: {fmtBRL(issue.value)}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Abra o Pipeline filtrado para tratar essas oportunidades.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link to={pipelineLink(issue.id)}>
            Abrir no Pipeline
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
