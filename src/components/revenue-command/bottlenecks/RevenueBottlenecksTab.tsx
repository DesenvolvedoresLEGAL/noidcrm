import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRevenueBottlenecks } from '@/hooks/revenue-command/useRevenueBottlenecks';
import { FunnelLeakageCards } from './FunnelLeakageCards';
import { DealDeathMap } from './DealDeathMap';
import { LossReasonsRanking } from './LossReasonsRanking';
import { RevenueRiskPanel } from './RevenueRiskPanel';
import { BottleneckExecutiveSummary } from './BottleneckExecutiveSummary';

/**
 * Sprint REVOPS V3.2 — Aba "Gargalos" do Revenue Command Center.
 *
 * Responde: "Onde a receita está vazando?"
 * Consome SOMENTE fontes oficiais existentes (Win/Loss, Forecast, Qualidade
 * de Qualificação, Resultados/Auditoria, Propostas). Nenhuma regra financeira
 * é alterada e nenhuma nova fonte de verdade é criada.
 */
export function RevenueBottlenecksTab() {
  const { data, isLoading } = useRevenueBottlenecks();
  const empty = !data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Gargalos</h2>
          <p className="text-sm text-muted-foreground">
            Onde o funil trava, onde oportunidades morrem e onde a receita vaza.
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
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Pipeline comercial não configurado</AlertTitle>
          <AlertDescription className="text-xs">
            Defina o pipeline oficial de Vendas em Configurações &gt; Forecast para que o
            Revenue Command Center calcule receita em risco apenas no escopo comercial.
          </AlertDescription>
        </Alert>
      )}

      {data?.meta.partial && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
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

      <BottleneckExecutiveSummary
        summary={data?.executiveSummary ?? ''}
        loading={isLoading || empty}
      />

      <FunnelLeakageCards leaks={data?.funnelLeaks ?? []} loading={isLoading || empty} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DealDeathMap stages={data?.deathStages ?? []} loading={isLoading || empty} />
        <LossReasonsRanking
          reasons={data?.lossReasons ?? []}
          loading={isLoading || empty}
        />
      </div>

      <RevenueRiskPanel
        risks={data?.revenueRisk ?? []}
        speedMetrics={data?.speedMetrics ?? []}
        loading={isLoading || empty}
      />

      {data && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Dados consolidados a partir de {data.meta.sources.join(', ')}.
        </p>
      )}
    </div>
  );
}
