import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RFM_SEGMENT_LABEL, type RFMAccountRow, type RFMSegment } from '@/services/crm/account-rfm';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const SEGMENT_TONE: Record<RFMSegment, string> = {
  campeao: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  vip: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  leal: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  promissor: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  novo_cliente: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  precisa_atencao: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  em_risco: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  hibernando: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  perdido: 'bg-red-500/10 text-red-600 border-red-500/30',
};

type SortKey = 'total_revenue' | 'last_won_date' | 'rfm_score';

interface Props {
  accounts: RFMAccountRow[] | undefined;
  loading?: boolean;
}

export function RFMAccountsTable({ accounts, loading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total_revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...(accounts || [])];
    arr.sort((a, b) => {
      let av: number = 0, bv: number = 0;
      if (sortKey === 'total_revenue') { av = a.total_revenue; bv = b.total_revenue; }
      else if (sortKey === 'rfm_score') { av = a.rfm_score; bv = b.rfm_score; }
      else if (sortKey === 'last_won_date') {
        av = a.last_won_date ? new Date(a.last_won_date).getTime() : 0;
        bv = b.last_won_date ? new Date(b.last_won_date).getTime() : 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [accounts, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <Button variant="ghost" size="sm" className="h-8 -ml-2" onClick={() => toggleSort(k)}>
      {label} <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  if (!loading && sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-md">
        Nenhuma venda fechada no período. Recalcule o RFM ou ajuste o intervalo.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Conta</TableHead>
            <TableHead><SortBtn k="last_won_date" label="Última contratação" /></TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right"><SortBtn k="total_revenue" label="Receita total" /></TableHead>
            <TableHead className="text-center">R</TableHead>
            <TableHead className="text-center">F</TableHead>
            <TableHead className="text-center">M</TableHead>
            <TableHead className="text-right"><SortBtn k="rfm_score" label="Score RFM" /></TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Ação sugerida</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((a) => (
            <TableRow key={a.account_id}>
              <TableCell className="font-medium">{a.account_name || '—'}</TableCell>
              <TableCell>
                {a.last_won_date ? format(new Date(a.last_won_date), 'dd MMM yyyy', { locale: ptBR }) : '—'}
              </TableCell>
              <TableCell className="text-right">{a.won_count}</TableCell>
              <TableCell className="text-right">{fmtBRL(a.total_revenue)}</TableCell>
              <TableCell className="text-center">{a.r_score}</TableCell>
              <TableCell className="text-center">{a.f_score}</TableCell>
              <TableCell className="text-center">{a.m_score}</TableCell>
              <TableCell className="text-right font-semibold">{a.rfm_score.toFixed(1)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={SEGMENT_TONE[a.rfm_segment]}>
                  {RFM_SEGMENT_LABEL[a.rfm_segment]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{a.owner_name || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[260px]">{a.suggested_action || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
