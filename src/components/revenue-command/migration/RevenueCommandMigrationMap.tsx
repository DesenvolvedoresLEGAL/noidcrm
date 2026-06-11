/**
 * Sprint RCC V3.9 — Mapa de migração das telas legadas para o Revenue Command.
 */
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MigrationEntry, MigrationStatus } from '@/hooks/revenue-command/useRevenueCommandMigrationAudit';

const STATUS_TONE: Record<MigrationStatus, { label: string; className: string }> = {
  migrated:     { label: 'Migrada',     className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  partial:      { label: 'Parcial',     className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  not_migrated: { label: 'Não migrada', className: 'bg-muted text-muted-foreground border-border' },
};

interface Props {
  entries: MigrationEntry[];
}

export function RevenueCommandMigrationMap({ entries }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTree className="h-4 w-4 text-muted-foreground" />
          Mapa de migração
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tela original</TableHead>
              <TableHead>Nova casa no RCC</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              const tone = STATUS_TONE[e.status];
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <Link to={e.legacyRoute} className="hover:underline">
                      {e.legacyLabel}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{e.rccTab}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(tone.className)}>
                      {tone.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {e.notes ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={e.rccRoute}>
                        Abrir RCC
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
