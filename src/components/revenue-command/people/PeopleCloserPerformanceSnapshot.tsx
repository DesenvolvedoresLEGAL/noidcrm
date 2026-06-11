import { ArrowRight, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { PeopleCloserSnapshotRow } from '@/hooks/revenue-command/useRevenuePeople';

const CLS_TONE: Record<PeopleCloserSnapshotRow['classification'], string> = {
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  good: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  attention: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  risk: 'bg-red-500/10 text-red-600 border-red-500/30',
  volume_no_quality: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  low_volume: 'bg-muted text-muted-foreground border-border',
  insufficient: 'bg-muted text-muted-foreground border-border',
};

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function PeopleCloserPerformanceSnapshot({ rows }: { rows: PeopleCloserSnapshotRow[] }) {
  return (
    <RevenueSectionCard
      title="Closer · Conversão vs Receita"
      description="Top 5 closers do período. Detalhe completo em Objetivos → Desempenho → Closer."
      icon={Briefcase}
      actions={
        <Link
          to="/app/objetivos/desempenho?tab=closer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Abrir Closer
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados de closer no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Receita Válida</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Perdidos</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Pipeline Ativo</TableHead>
                <TableHead className="text-right">Ciclo</TableHead>
                <TableHead>Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.revenue)}</TableCell>
                  <TableCell className="text-right">{r.won}</TableCell>
                  <TableCell className="text-right">{r.lost}</TableCell>
                  <TableCell className="text-right">
                    {r.winRatePct !== null ? `${r.winRatePct.toFixed(0)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right">{fmtBRL(r.avgTicket)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.activePipeline)}</TableCell>
                  <TableCell className="text-right">
                    {r.avgCycleDays !== null ? `${r.avgCycleDays.toFixed(0)}d` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', CLS_TONE[r.classification])}>
                      {r.classificationLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </RevenueSectionCard>
  );
}
