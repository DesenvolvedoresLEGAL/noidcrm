import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ForecastSellerRiskRankingV2 } from '@/types/forecast-risk-center';
import { getRiskScoreLabel } from '@/types/forecast-risk-center';
import { cn } from '@/lib/utils';

interface Props {
  ranking: ForecastSellerRiskRankingV2[];
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function toneClass(tone: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (tone) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    default: return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
  }
}

export function SellerRiskRankingTable({ ranking }: Props) {
  if (!ranking?.length) {
    return <p className="text-sm text-muted-foreground">Sem ranking disponível.</p>;
  }
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-right">Valor em Risco</TableHead>
            <TableHead className="text-right">Deals</TableHead>
            <TableHead className="text-right">Slipping</TableHead>
            <TableHead className="text-right">Higiene</TableHead>
            <TableHead className="text-right">Contaminado</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((r) => {
            const lbl = getRiskScoreLabel(r.risk_score ?? 0);
            return (
              <TableRow key={r.seller_id}>
                <TableCell className="font-medium">{r.seller_name || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(r.risk_amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.risk_deals_count}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(r.slipping_amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.hygiene_issue_deals}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(r.contaminated_realistic_amount)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn(toneClass(lbl.tone))}>{r.risk_score} · {lbl.label}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.recommended_action}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
