import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCoverageAnalysis, useRecalculateCoverage } from '@/hooks/intelligence/useCoverageAnalysis';
import { CoverageBadge } from './CoverageBadge';

interface SmartCoverageTabProps {
  prospectId: string;
}

export function SmartCoverageTab({ prospectId }: SmartCoverageTabProps) {
  const { data, isLoading, isError } = useCoverageAnalysis(prospectId);
  const recalculate = useRecalculateCoverage();

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card data-component="smart-coverage-tab">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">Smart Coverage</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={recalculate.isPending}
            onClick={() => recalculate.mutate({ prospectId, force: true })}
          >
            {recalculate.isPending ? 'Analisando…' : data ? 'Recalcular' : 'Analisar'}
          </Button>
        </div>
        {data && (
          <CoverageBadge
            score={data.score}
            coverageClass={data.class}
            missing={data.missing}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isError && (
          <p className="text-muted-foreground">Não foi possível carregar a cobertura.</p>
        )}
        {!isError && !data && (
          <p className="text-muted-foreground">Nenhuma análise de cobertura disponível.</p>
        )}
        {data?.next_best_action && (
          <section className="space-y-1">
            <h4 className="font-medium">Próxima ação</h4>
            <p className="text-muted-foreground">{data.next_best_action}</p>
          </section>
        )}
        {data?.missing && data.missing.length > 0 && (
          <section className="space-y-1">
            <h4 className="font-medium">Pendências</h4>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {data.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        {data?.recommendations && data.recommendations.length > 0 && (
          <section className="space-y-1">
            <h4 className="font-medium">Recomendações</h4>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {data.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}