/**
 * Sprint RCC V3.9 — Mapa de dependências: quais módulos alimentam cada aba do RCC.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network } from 'lucide-react';
import type { DependencyEntry } from '@/hooks/revenue-command/useRevenueCommandMigrationAudit';

interface Props {
  dependencies: DependencyEntry[];
}

export function RevenueCommandDependencyMap({ dependencies }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-4 w-4 text-muted-foreground" />
          Mapa de dependências
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2">
          {dependencies.map((d) => (
            <div key={d.rccTab} className="rounded-md border p-3">
              <p className="text-sm font-semibold">{d.rccTab}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {d.sources.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {s}
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
