import { Card, CardContent } from '@/components/ui/card';
import { useQualifiedQueueKpis } from '@/hooks/intelligence/useQualifiedQueueKpis';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS: Array<{ key: keyof Awaited<ReturnType<typeof useQualifiedQueueKpis>>['data'] extends infer T ? T extends object ? keyof T : never : never; label: string }> = [
  { key: 'captured' as any, label: 'Capturados' },
  { key: 'qualified' as any, label: 'Qualificados' },
  { key: 'ready_for_sdr' as any, label: 'Prontos para SDR' },
  { key: 'review' as any, label: 'Em revisão' },
  { key: 'imported' as any, label: 'Importados' },
  { key: 'discarded' as any, label: 'Descartados' },
  { key: 'conversion_rate' as any, label: 'Aproveitamento (%)' },
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
      {ITEMS.map(({ key, label }) => (
        <Card key={label}>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">
              {data ? (data as any)[key] ?? 0 : 0}
              {key === ('conversion_rate' as any) ? '%' : ''}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
