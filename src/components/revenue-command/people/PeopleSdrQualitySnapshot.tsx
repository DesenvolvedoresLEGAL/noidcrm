import { ArrowRight, UserCheck } from 'lucide-react';
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
import type { PeopleSdrSnapshotRow } from '@/hooks/revenue-command/useRevenuePeople';

const CLS_TONE: Record<PeopleSdrSnapshotRow['classification'], string> = {
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  good: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  attention: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  risk: 'bg-red-500/10 text-red-600 border-red-500/30',
  volume_no_quality: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  low_volume: 'bg-muted text-muted-foreground border-border',
  insufficient: 'bg-muted text-muted-foreground border-border',
};

function fmtBRL(v: number | null) {
  if (v === null || v === undefined) return 'N/D';
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}
function fmtInt(v: number | null) {
  return v === null || v === undefined ? 'N/D' : String(v);
}
function fmtPct(v: number | null) {
  return v === null || v === undefined ? 'N/D' : `${v.toFixed(0)}%`;
}

export function PeopleSdrQualitySnapshot({ rows }: { rows: PeopleSdrSnapshotRow[] }) {
  return (
    <RevenueSectionCard
      title="SDR · Volume vs Qualidade"
      description="Top 5 SDRs do período. Análise detalhada em Objetivos → Desempenho."
      icon={UserCheck}
      actions={
        <Link
          to="/app/objetivos/desempenho?tab=qualidade"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Abrir Qualidade
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados de SDR no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SDR</TableHead>
                <TableHead className="text-right">SQLs</TableHead>
                <TableHead className="text-right">c/ Proposta</TableHead>
                <TableHead className="text-right">SQL→Prop</TableHead>
                <TableHead className="text-right">SQL→Venda</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead>Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.qualified}</TableCell>
                  <TableCell className="text-right">{r.withProposal}</TableCell>
                  <TableCell className="text-right">{r.sqlToProposalPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{r.sqlToWonPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.revenue)}</TableCell>
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
