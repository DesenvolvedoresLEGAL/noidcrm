import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import type { ProductSoldRow } from '@/hooks/useProductsReport';

type SortKey = 'name' | 'sales_count' | 'total_quantity' | 'total_revenue' | 'avg_ticket' | 'share_pct';

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v || 0);
}
function fmtInt(v: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
}
function fmtPct(v: number) {
  return `${(v || 0).toFixed(1)}%`;
}

function billingLabel(t: string) {
  if (t === 'recurring') return 'Recorrente';
  if (t === 'one_time') return 'Pontual';
  return t || '—';
}

export function ProductsRankingTable({ data }: { data: ProductSoldRow[] }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total_revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    const filtered = query
      ? data.filter((r) => r.name?.toLowerCase().includes(query.toLowerCase()))
      : data.slice();
    return filtered.sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [data, query, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  function exportCSV() {
    const header = ['Produto', 'Tipo', 'Vendas', 'Propostas', 'Quantidade', 'Receita', 'Ticket médio', 'Mix %'];
    const lines = rows.map((r) => [
      `"${(r.name || '').replace(/"/g, '""')}"`,
      billingLabel(r.billing_type),
      r.sales_count,
      r.proposals_count,
      r.total_quantity,
      Number(r.total_revenue).toFixed(2),
      Number(r.avg_ticket).toFixed(2),
      Number(r.share_pct).toFixed(2),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos-vendidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children} <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Ranking de Produtos</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-8 h-9 w-56"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th k="name">Produto</Th>
                <TableHead>Tipo</TableHead>
                <Th k="sales_count" className="text-right">Vendas</Th>
                <Th k="total_quantity" className="text-right">Qtd</Th>
                <Th k="total_revenue" className="text-right">Receita</Th>
                <Th k="avg_ticket" className="text-right">Ticket médio</Th>
                <Th k="share_pct" className="text-right">Mix</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum produto vendido no período.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.product_key}>
                  <TableCell className="font-medium max-w-[320px] truncate">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.billing_type === 'recurring' ? 'default' : 'secondary'}>
                      {billingLabel(r.billing_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(r.sales_count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(r.total_quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(r.total_revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.avg_ticket)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(r.share_pct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
