import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRevenueTodayCommand } from '@/hooks/revenue-command/useRevenueTodayCommand';
import { RevenueExecutiveScoreboard } from './RevenueExecutiveScoreboard';
import { RevenueWhatChanged } from './RevenueWhatChanged';
import { RevenueOperationAlerts } from './RevenueOperationAlerts';
import { RevenueNextActions } from './RevenueNextActions';

/**
 * Sprint REVOPS V3.1 — Aba "Hoje na Operação"
 *
 * Painel executivo consolidado a partir de fontes oficiais já existentes
 * (Resultados, Forecast, Desempenho, Win/Loss, Qualidade de Qualificação).
 *
 * Não cria nem altera regra financeira. Apenas leitura.
 */
export function RevenueTodayTab() {
  const { data, isLoading } = useRevenueTodayCommand();

  const empty = !data;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Hoje na Operação</h2>
        <p className="text-sm text-muted-foreground">
          O resumo do que merece atenção comercial agora.
        </p>
      </header>

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

      <RevenueExecutiveScoreboard
        scoreboard={
          data?.scoreboard ?? {
            validRevenue: 0,
            cancelledRevenue: 0,
            cancelledCount: 0,
            monthlyGoal: 0,
            goalAttainmentPct: null,
            forecastRealistic: null,
            activePipeline: null,
            winRate: null,
            qualifiedSqls: null,
            validCount: 0,
          }
        }
        loading={isLoading || empty}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueWhatChanged changes={data?.changes ?? []} loading={isLoading || empty} />
        <RevenueOperationAlerts alerts={data?.alerts ?? []} loading={isLoading || empty} />
      </div>

      <RevenueNextActions actions={data?.nextActions ?? []} loading={isLoading || empty} />

      {data && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Dados consolidados a partir de {data.meta.sources.join(', ')}.
        </p>
      )}
    </div>
  );
}
