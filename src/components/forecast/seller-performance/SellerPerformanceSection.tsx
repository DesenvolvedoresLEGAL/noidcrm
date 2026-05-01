import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastSellerPerformance } from '@/hooks/forecast/useForecastSellerPerformance';
import { SellerHighlightCards } from './SellerHighlightCards';
import { SellerPerformanceTable } from './SellerPerformanceTable';
import { SellerForecastTable } from '@/components/forecast/SellerForecastTable';
import type { SellerForecast } from '@/hooks/useForecastData';

interface Props {
  periodStart: Date;
  periodEnd: Date;
  pipelineId?: string;
  legacySellers: SellerForecast[];
}

export function SellerPerformanceSection({ periodStart, periodEnd, pipelineId, legacySellers }: Props) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const { sellers, isLoading, error } = useForecastSellerPerformance({
    organizationId: orgId,
    pipelineId: pipelineId ?? null,
    periodStart: format(periodStart, 'yyyy-MM-dd'),
    periodEnd: format(periodEnd, 'yyyy-MM-dd'),
    enabled: Boolean(orgId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar a performance V2</AlertTitle>
          <AlertDescription className="text-xs">
            Exibindo a versão clássica enquanto a nova fonte é restabelecida. Detalhe: {error.message}
          </AlertDescription>
        </Alert>
        <SellerForecastTable sellers={legacySellers} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SellerHighlightCards sellers={sellers} />
      <SellerPerformanceTable sellers={sellers} />
    </div>
  );
}
