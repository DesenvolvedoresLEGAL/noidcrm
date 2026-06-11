/**
 * Sprint RCC V3.11 — Executive War Room.
 *
 * Painel executivo fixo no topo do Revenue Command Center.
 * Consome `useRevenueExecutiveWarRoom` (somente leitura) e expõe
 * Health Score, Situação do Mês, Resposta Executiva, Radar, Top Riscos,
 * Top Ações e Health & Trust mini.
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Gauge,
  HelpCircle,
  ListChecks,
  Radar as RadarIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useRevenueExecutiveWarRoom,
  type RadarSignal,
  type WarRoomActionMini,
  type WarRoomData,
  type WarRoomRiskMini,
  type WarRoomScoreLabel,
} from '@/hooks/revenue-command/useRevenueExecutiveWarRoom';

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

const SCORE_TONES: Record<WarRoomScoreLabel, { ring: string; text: string; badge: string }> = {
  Excelente: {
    ring: 'ring-emerald-500/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  },
  Atenção: {
    ring: 'ring-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  },
  Risco: {
    ring: 'ring-orange-500/40',
    text: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400',
  },
  Crítico: {
    ring: 'ring-red-500/40',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400',
  },
  Indisponível: {
    ring: 'ring-border',
    text: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

const RADAR_TONES: Record<RadarSignal['status'], string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-muted-foreground/40',
};

const SEVERITY_TONES: Record<WarRoomRiskMini['severity'], string> = {
  high: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
  low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
};

const PRIORITY_TONES: Record<WarRoomActionMini['priority'], string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground border-border',
};

function Section({ title, icon: Icon, children, action }: { title: string; icon: React.ComponentType<{ className?: string }>; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function HealthScoreCard({ data }: { data: WarRoomData }) {
  const { healthScore } = data;
  const tone = SCORE_TONES[healthScore.label];
  const pct = healthScore.score ?? 0;
  return (
    <Card className={cn('overflow-hidden ring-1', tone.ring)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Revenue Health Score
          </span>
          <Badge variant="outline" className={cn('text-[10px]', tone.badge)}>
            {healthScore.label}
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-4xl font-bold tabular-nums', tone.text)}>
            {healthScore.score ?? '—'}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-xs leading-relaxed text-muted-foreground">{healthScore.summary}</p>
        <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
          {Object.entries(healthScore.breakdown).map(([k, v]) => (
            <div key={k} className="rounded-md border border-border/60 px-2 py-1">
              <div className="capitalize text-muted-foreground">{k}</div>
              <div className="font-semibold tabular-nums">
                {v.score}<span className="text-muted-foreground">/{v.max}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthSituationCard({ data }: { data: WarRoomData }) {
  const m = data.monthSituation;
  const pct = m.hasGoal ? Math.min(100, (m.realized / m.goal) * 100) : 0;
  return (
    <Section title="Situação do mês" icon={Target}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Metric label="Meta" value={m.hasGoal ? fmtBRL(m.goal) : '—'} />
        <Metric label="Realizado" value={fmtBRL(m.realized)} tone="good" />
        <Metric label="Commit" value={fmtBRL(m.commit)} />
        <Metric label="Best Case" value={fmtBRL(m.bestCase)} />
        <Metric label="Gap até meta" value={m.hasGoal ? fmtBRL(m.gap) : '—'} tone={m.gap > 0 ? 'bad' : 'good'} />
        <Metric label="Dias restantes" value={`${m.daysRemaining}`} />
      </div>
      {m.hasGoal && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Atingimento</span>
            <span className="tabular-nums">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      )}
    </Section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-sm font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ExecutiveAnswerCard({ data }: { data: WarRoomData }) {
  const a = data.executiveAnswer;
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <HelpCircle className="h-4 w-4" />
          {a.question}
        </div>
        <p className="text-sm leading-relaxed">{a.answer}</p>
        {a.impact > 0 && (
          <Badge variant="outline" className="text-[10px]">
            Impacto estimado: {fmtBRL(a.impact)}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function RadarCard({ data }: { data: WarRoomData }) {
  return (
    <Section title="Radar executivo" icon={RadarIcon}>
      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {data.radar.map((s) => (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-2 text-center">
                  <span className={cn('h-2.5 w-2.5 rounded-full', RADAR_TONES[s.status])} />
                  <span className="text-[10px] font-medium">{s.label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {s.reason}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </Section>
  );
}

function TopRisksCard({ data }: { data: WarRoomData }) {
  return (
    <Section title="Top 3 riscos" icon={AlertTriangle}>
      {data.topRisks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum risco crítico identificado.</p>
      ) : (
        <ul className="space-y-2">
          {data.topRisks.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[9px] uppercase', SEVERITY_TONES[r.severity])}>
                    {r.severity === 'high' ? 'Alto' : r.severity === 'medium' ? 'Médio' : 'Baixo'}
                  </Badge>
                  <span className="truncate text-sm font-medium">{r.title}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{r.impactLabel}</div>
              </div>
              <Link
                to={r.cta.to}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {r.cta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TopActionsCard({ data }: { data: WarRoomData }) {
  return (
    <Section title="Top 3 ações de hoje" icon={ListChecks}>
      {data.topActions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem ações priorizadas no momento.</p>
      ) : (
        <ul className="space-y-2">
          {data.topActions.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[9px] uppercase', PRIORITY_TONES[a.priority])}>
                    {a.priority}
                  </Badge>
                  <span className="truncate text-sm font-medium">{a.title}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{a.impactLabel}</div>
              </div>
              <Link
                to={a.cta.to}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {a.cta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TrustMiniCard({ data }: { data: WarRoomData }) {
  const t = data.trustMini;
  const updated = (() => {
    try {
      const d = new Date(t.updatedAt);
      const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
      if (diffMin < 1) return 'há instantes';
      if (diffMin < 60) return `há ${diffMin} min`;
      const h = Math.round(diffMin / 60);
      return `há ${h}h`;
    } catch {
      return '—';
    }
  })();
  return (
    <Section title="Health & Trust" icon={ShieldCheck}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{t.score ?? '—'}</span>
        <span className="text-xs text-muted-foreground">/100 · {t.label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400">
          {t.ok} OK
        </Badge>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400">
          {t.partial} parciais
        </Badge>
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400">
          {t.failed} falha
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          Atualizado {updated}
        </span>
        <Link to={t.cta.to} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {t.cta.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Section>
  );
}

function PartialBanner({ partial }: { partial: string[] }) {
  if (partial.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5" />
      Dados parciais — usando apenas as fontes disponíveis ({partial.join(', ')}).
    </div>
  );
}

export function RevenueExecutiveWarRoom() {
  const { data, isLoading } = useRevenueExecutiveWarRoom();

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-44 lg:col-span-1" />
          <Skeleton className="h-44 lg:col-span-1" />
          <Skeleton className="h-44 lg:col-span-1" />
        </div>
        <Skeleton className="h-24" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className="space-y-3" aria-label="Executive War Room">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Executive War Room
          <TrendingUp className="h-3 w-3" />
        </div>
        <Badge variant="outline" className="text-[10px] capitalize">
          Confiança: {data.meta.confidence}
        </Badge>
      </div>

      <PartialBanner partial={data.meta.partialSources} />

      <div className="grid gap-3 lg:grid-cols-3">
        <HealthScoreCard data={data} />
        <MonthSituationCard data={data} />
        <ExecutiveAnswerCard data={data} />
      </div>

      <RadarCard data={data} />

      <div className="grid gap-3 lg:grid-cols-3">
        <TopRisksCard data={data} />
        <TopActionsCard data={data} />
        <TrustMiniCard data={data} />
      </div>
    </section>
  );
}

export default RevenueExecutiveWarRoom;
