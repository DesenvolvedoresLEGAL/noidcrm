/**
 * Sprint RCC V3.9 — Métricas duplicadas entre módulos.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';
import type { DuplicateMetric } from '@/hooks/revenue-command/useRevenueCommandMigrationAudit';

interface Props {
  duplicates: DuplicateMetric[];
}

export function RevenueCommandDuplicateMetrics({ duplicates }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Copy className="h-4 w-4 text-muted-foreground" />
          Métricas em múltiplos lugares
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {duplicates.map((d) => (
            <div key={d.metric} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              <span className="text-sm font-medium">{d.metric}</span>
              <Badge variant="outline" className="ml-1">
                {d.locations.length} telas
              </Badge>
              <div className="flex flex-wrap gap-1">
                {d.locations.map((loc) => (
                  <Badge key={loc} variant="secondary" className="text-xs">
                    {loc}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
