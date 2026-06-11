/**
 * Sprint RCC V3.8 — Aba "Health & Trust" do Revenue Command Center.
 *
 * Camada de governança somente leitura. Mostra a saúde dos dados, cobertura,
 * confiança, problemas detectados e impacto financeiro de falhas de dados.
 *
 * Não altera tabelas, views, edge functions ou regras financeiras.
 */
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  Database,
  AlertTriangle,
  CircleDollarSign,
  GitCompare,
  History,
  Wrench,
  ArrowRight,
  CheckCircle2,
  XCircle,
  CircleDot,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useRevenueHealthTrust,
  type SourceStatus,
  type SourceHealth,
  type TrustLabel,
} from '@/hooks/revenue-command/useRevenueHealthTrust';

const TRUST_TONE: Record<TrustLabel, { className: string; icon: any }> = {
  Excelente:      { className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', icon: ShieldCheck },
  Confiável:      { className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', icon: ShieldCheck },
  Atenção:        { className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',         icon: Shield },
  'Baixa confiança': { className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30', icon: ShieldAlert },
  Crítico:        { className: 'bg-destructive/10 text-destructive border-destructive/30',                       icon: ShieldAlert },
  Indisponível:   { className: 'bg-muted text-muted-foreground border-border',                                   icon: ShieldQuestion },
};

const STATUS_LABEL: Record<SourceStatus, string> = {
  ok: 'OK',
  partial: 'Parcial',
  failed: 'Falha',
  unavailable: 'Indisponível',
  loading: 'Carregando',
};

const HEALTH_TONE: Record<SourceHealth, string> = {
  healthy:  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  attention:'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  unknown:  'bg-muted text-muted-foreground border-border',
};

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'indisponível';
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `há ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.round(hours / 24)} d`;
  } catch {
    return 'indisponível';
  }
}

export function RevenueHealthTrustTab() {
  const { data, isLoading } = useRevenueHealthTrust();

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <ShieldQuestion className="h-4 w-4" />
        <AlertTitle>Health & Trust indisponível</AlertTitle>
        <AlertDescription>
          Nenhuma fonte do Revenue Command pôde ser carregada no momento.
        </AlertDescription>
      </Alert>
    );
  }

  const trustCfg = TRUST_TONE[data.trustLabel];
  const TrustIcon = trustCfg.icon;

  return (
    <div className="space-y-4">
      {/* Bloco 1 — Trust Score */}
      <Card className={cn('border-2', trustCfg.className.replace('text-', 'border-').split(' ')[2] ?? '')}>
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className={cn('rounded-full p-3', trustCfg.className)}>
              <TrustIcon className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                CRM Trust Score
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-4xl font-bold tracking-tight">
                  {data.trustScore ?? '—'}
                </h2>
                <span className="text-sm text-muted-foreground">/ 100</span>
                <Badge variant="outline" className={cn('ml-2', trustCfg.className)}>
                  {data.trustLabel}
                </Badge>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">{data.trustSummary}</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: 'Integridade', value: data.breakdown.integrity },
              { label: 'Cobertura', value: data.breakdown.coverage },
              { label: 'Atualização', value: data.breakdown.freshness },
              { label: 'Higiene', value: data.breakdown.hygiene },
              { label: 'Consistência', value: data.breakdown.consistency },
            ].map((b) => (
              <div key={b.label} className="min-w-[64px] rounded-lg border bg-muted/40 px-2 py-2">
                <div className="text-base font-semibold">{b.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Status das fontes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-muted-foreground" />
            Status das fontes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.sources.map((s) => {
              const Icon =
                s.status === 'ok' ? CheckCircle2 :
                s.status === 'failed' || s.status === 'unavailable' ? XCircle :
                s.status === 'loading' ? Loader2 : CircleDot;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.helper ?? `Atualizado ${timeAgo(s.updatedAt)}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('gap-1', HEALTH_TONE[s.health])}>
                    <Icon className={cn('h-3 w-3', s.status === 'loading' && 'animate-spin')} />
                    {STATUS_LABEL[s.status]}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bloco 3 — Cobertura */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Cobertura dos dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.coverage.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem oportunidades abertas para avaliar cobertura.
              </p>
            ) : (
              data.coverage.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="font-medium">{c.coveredPct}%</span>
                  </div>
                  <Progress value={c.coveredPct} className="h-2" />
                  {c.missingCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {c.missingCount} de {c.totalCount} sem este dado
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Bloco 4 — Problemas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Problemas detectados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum problema crítico detectado no momento.
              </p>
            ) : (
              data.issues.slice(0, 8).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Impacto estimado: {i.impactLabel}
                    </p>
                  </div>
                  {i.cta && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={i.cta.to}>
                        {i.cta.label}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bloco 5 — Impacto financeiro */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            Impacto financeiro
          </CardTitle>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total afetado</p>
            <p className="text-xl font-bold text-destructive">
              {fmtBRL(data.financialImpact.total)}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {data.financialImpact.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum valor monetizável afetado por problemas de dados.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.financialImpact.items.map((i) => (
                <div key={i.id} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{i.label}</p>
                  <p className="text-base font-semibold">{fmtBRL(i.value)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bloco 6 — Consistência */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-4 w-4 text-muted-foreground" />
              Consistência entre fontes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.consistency.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem checks de consistência disponíveis no momento.
              </p>
            ) : (
              data.consistency.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.left.label}: {c.left.value != null ? fmtBRL(c.left.value) : '—'} ·{' '}
                      {c.right.label}: {c.right.value != null ? fmtBRL(c.right.value) : '—'}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      c.status === 'ok' && HEALTH_TONE.healthy,
                      c.status === 'diverged' && HEALTH_TONE.attention,
                      c.status === 'unavailable' && HEALTH_TONE.unknown,
                    )}
                  >
                    {c.status === 'ok' ? 'OK' :
                     c.status === 'diverged' ? `Divergência ${c.diff != null ? fmtBRL(c.diff) : ''}` :
                     'Indisponível'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Bloco 7 — Histórico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />
              Histórico de saúde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Histórico insuficiente. O Trust Score começará a registrar tendências após
              acumular snapshots diários.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bloco 8 — Ações recomendadas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Ações recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação recomendada no momento.
            </p>
          ) : (
            data.actions.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.reason} · Impacto: {a.impactValue > 0 ? fmtBRL(a.impactValue) : '—'}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={a.to}>
                    {a.ctaLabel}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-right text-xs text-muted-foreground">
        Fontes carregadas: {data.meta.healthySources}/{data.meta.sourceCount} ·
        {' '}Atualizado {timeAgo(data.meta.generatedAt)}
      </p>
    </div>
  );
}
