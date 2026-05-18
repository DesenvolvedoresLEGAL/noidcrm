import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductCrossRow } from '@/hooks/useProductsReport';

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function CrossTable({ rows, leftLabel }: { rows: ProductCrossRow[]; leftLabel: string }) {
  const top = rows.slice().sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 30);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{leftLabel}</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Vendas</TableHead>
            <TableHead className="text-right">Receita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
          )}
          {top.map((r, i) => (
            <TableRow key={`${r.dimension}-${r.entity_id}-${r.product_key}-${i}`}>
              <TableCell className="font-medium">{r.entity_name || '—'}</TableCell>
              <TableCell className="text-muted-foreground">{r.product_name}</TableCell>
              <TableCell className="text-right tabular-nums">{r.sales_count}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(Number(r.total_revenue))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProductsCrossAnalysis({ data }: { data: ProductCrossRow[] }) {
  const byCloser = useMemo(() => data.filter(d => d.dimension === 'closer'), [data]);
  const byAccount = useMemo(() => data.filter(d => d.dimension === 'account'), [data]);
  const byPipeline = useMemo(() => data.filter(d => d.dimension === 'pipeline'), [data]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cross-analysis</CardTitle></CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={['closer']}>
          <AccordionItem value="closer">
            <AccordionTrigger>Produto × Closer</AccordionTrigger>
            <AccordionContent><CrossTable rows={byCloser} leftLabel="Closer" /></AccordionContent>
          </AccordionItem>
          <AccordionItem value="account">
            <AccordionTrigger>Produto × Cliente</AccordionTrigger>
            <AccordionContent><CrossTable rows={byAccount} leftLabel="Cliente" /></AccordionContent>
          </AccordionItem>
          <AccordionItem value="pipeline">
            <AccordionTrigger>Produto × Pipeline</AccordionTrigger>
            <AccordionContent><CrossTable rows={byPipeline} leftLabel="Pipeline" /></AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
