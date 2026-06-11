/**
 * Sprint REVOPS V3.4 — Aba "Pessoas" do Revenue Command Center.
 *
 * Camada executiva de pessoas. NÃO substitui o módulo Objetivos → Desempenho.
 * Apenas consolida sinais críticos a partir de fontes oficiais já existentes.
 */
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevenuePeople } from '@/hooks/revenue-command/useRevenuePeople';
import { PeopleExecutiveScoreboard } from './PeopleExecutiveScoreboard';
import { PeopleTopPerformers } from './PeopleTopPerformers';
import { PeopleNeedsHelp } from './PeopleNeedsHelp';
import { PeopleSdrQualitySnapshot } from './PeopleSdrQualitySnapshot';
import { PeopleCloserPerformanceSnapshot } from './PeopleCloserPerformanceSnapshot';
import { PeopleConcentrationRisk } from './PeopleConcentrationRisk';
import { PeopleRecommendedActions } from './PeopleRecommendedActions';

export function RevenuePeopleTab() {
  const { data, isLoading } = useRevenuePeople();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Pessoas</h2>
        <p className="text-sm text-muted-foreground">
          Visão executiva da performance humana. Decisões rápidas; análise detalhada em{' '}
          <span className="font-medium">Objetivos → Desempenho</span>.
        </p>
      </header>

      {data.meta.partialSources.length > 0 && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Dados parciais</AlertTitle>
          <AlertDescription className="text-xs">
            Parte dos dados não pôde ser carregada ({data.meta.partialSources.join(', ')}).
            A leitura abaixo reflete apenas as fontes disponíveis.
          </AlertDescription>
        </Alert>
      )}

      <PeopleExecutiveScoreboard scoreboard={data.scoreboard} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PeopleTopPerformers items={data.topPerformers} />
        <PeopleNeedsHelp items={data.needsHelp} />
      </div>

      <PeopleSdrQualitySnapshot rows={data.sdrSnapshot} />
      <PeopleCloserPerformanceSnapshot rows={data.closerSnapshot} />
      <PeopleConcentrationRisk concentration={data.concentration} />
      <PeopleRecommendedActions actions={data.actions} />

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Dados consolidados a partir de {data.meta.sources.join(', ')}.
      </p>
    </div>
  );
}
