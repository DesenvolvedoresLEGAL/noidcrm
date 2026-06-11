import { Card, CardContent } from '@/components/ui/card';
import { useQualifiedQueueKpis } from '@/hooks/intelligence/useQualifiedQueueKpis';
import { Skeleton } from '@/components/ui/skeleton';
import type { QualifiedQueueKpis } from '@/services/intelligence/qualifiedQueue';

const ITEMS: Array<{ key: keyof QualifiedQueueKpis; label: string; suffix?: string }> = [
  { key: 'captured', label: 'Capturados' },
  { key: 'qualified', label: 'Qualificados' },
  { key: 'ready_for_sdr', label: 'Prontos para SDR' },
  { key: 'review', label: 'Em revisão' },
  { key: 'imported', label: 'Importados' },
  { key: 'discarded', label: 'Descartados' },
  { key: 'conversion_rate', label: 'Aproveitamento', suffix: '%' },
];

export function QualifiedQueueKpiBar() {
  const { data, isLoading } = useQualifiedQueueKpis();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {ITEMS.map((i) => (
          <Skeleton key={i.label} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {ITEMS.map(({ key, label, suffix }) => (
        <Card key={label}>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">
              {data?.[key] ?? 0}
              {suffix ?? ''}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
