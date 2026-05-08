import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CalendarRange } from 'lucide-react';
import { useInventoryCapacityByPeriod } from '@/hooks/operations/useInventoryOccupancy';
import {
  RISK_LEVEL_BADGE,
  RISK_LEVEL_LABELS,
  type CapacityRow,
} from '@/lib/operations/inventoryOccupancy';

function sum(rows: CapacityRow[], k: keyof CapacityRow) {
  return rows.reduce((acc, r) => acc + Number(r[k] ?? 0), 0);
}

function aggregate(rows: CapacityRow[]) {
  const total = sum(rows, 'total_units');
  const occ =
    sum(rows, 'pre_reserved_units') +
    sum(rows, 'reserved_units') +
    sum(rows, 'in_preparation_units') +
    sum(rows, 'dispatched_units') +
    sum(rows, 'in_operation_units') +
    sum(rows, 'returned_units');
  const rate = total > 0 ? occ / total : 0;
  return {
    total,
    available: sum(rows, 'available_units'),
    in_operation: sum(rows, 'in_operation_units'),
    returned: sum(rows, 'returned_units'),
    rate,
    risk:
      rate >= 0.9 ? 'critico' : rate >= 0.75 ? 'alto' : rate >= 0.5 ? 'medio' : 'baixo',
  };
}

export function InventoryOperationalCapacityBlock() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const next7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const next30 = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const cap7 = useInventoryCapacityByPeriod({
    start_date: today,
    end_date: next7,
    category_id: null,
    family_id: null,
  });
  const cap30 = useInventoryCapacityByPeriod({
    start_date: today,
    end_date: next30,
    category_id: null,
    family_id: null,
  });

  const a7 = useMemo(() => aggregate(cap7.data ?? []), [cap7.data]);
  const a30 = useMemo(() => aggregate(cap30.data ?? []), [cap30.data]);

  const critical = useMemo(
    () =>
      (cap30.data ?? [])
        .filter((r) => r.risk_level === 'alto' || r.risk_level === 'critico')
        .slice(0, 6),
    [cap30.data],
  );

  const isLoading = cap7.isLoading || cap30.isLoading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4" /> Capacidade operacional
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <Mini label="Ocupação 7 dias" value={`${Math.round(a7.rate * 100)}%`}
              risk={a7.risk} />
            <Mini label="Ocupação 30 dias" value={`${Math.round(a30.rate * 100)}%`}
              risk={a30.risk} />
            <Mini label="Capacidade livre (30d)" value={a30.available.toString()} />
            <Mini label="Em operação / retornos" value={`${a7.in_operation} / ${a7.returned}`} />
          </div>
        )}

        {critical.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Próximos períodos críticos (30 dias)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Família</th>
                    <th className="p-2 text-right">Ocupação</th>
                    <th className="p-2 text-center">Risco</th>
                  </tr>
                </thead>
                <tbody>
                  {critical.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.category_name ?? '—'}</td>
                      <td className="p-2">{r.family_name ?? '—'}</td>
                      <td className="p-2 text-right">
                        {Math.round((r.occupancy_rate ?? 0) * 100)}%
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant={RISK_LEVEL_BADGE[r.risk_level] ?? 'outline'}>
                          {RISK_LEVEL_LABELS[r.risk_level] ?? r.risk_level}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, risk }: { label: string; value: string; risk?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-xl font-semibold">{value}</div>
        {risk && (
          <Badge variant={RISK_LEVEL_BADGE[risk] ?? 'outline'}>
            {RISK_LEVEL_LABELS[risk] ?? risk}
          </Badge>
        )}
      </div>
    </div>
  );
}
