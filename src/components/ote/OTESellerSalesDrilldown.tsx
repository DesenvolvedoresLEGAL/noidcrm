import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';

interface Props {
  records: OTESalesRecord[];
  kind: 'sale' | 'qualified_lead';
  loading?: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

function revenueType(r: OTESalesRecord) {
  const mrr = Number(r.mrr_amount) || 0;
  const one = Number(r.one_shot_amount) || 0;
  if (mrr > 0 && one > 0) return 'Misto';
  if (mrr > 0) return 'MRR';
  if (one > 0) return 'One-shot';
  return '-';
}

export function OTESellerSalesDrilldown({ records, kind, loading }: Props) {
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-4">Carregando detalhamento...</div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        {kind === 'qualified_lead'
          ? 'Nenhum lead qualificado no período.'
          : 'Nenhuma venda registrada no período.'}
      </div>
    );
  }

  const eligible = records.filter((r) => r.counts_toward_goal);
  const excluded = records.filter((r) => !r.counts_toward_goal);

  const subtotal = eligible.reduce((s, r) => s + Number(r.sale_value || 0), 0);
  const excludedTotal = excluded.reduce((s, r) => s + Number(r.sale_value || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="text-sm font-semibold">
          {kind === 'qualified_lead'
            ? `Leads qualificados (${records.length})`
            : `Vendas no período (${records.length})`}
        </h5>
        <div className="text-xs text-muted-foreground flex gap-3">
          <span>
            Elegível para meta:{' '}
            <strong className="text-foreground">
              {kind === 'qualified_lead' ? `${eligible.length} leads` : fmtBRL(subtotal)}
            </strong>
          </span>
          {excluded.length > 0 && (
            <span>
              Fora da meta:{' '}
              <strong className="text-foreground">
                {kind === 'qualified_lead' ? `${excluded.length} leads` : fmtBRL(excludedTotal)}
              </strong>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / Oportunidade</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>{kind === 'qualified_lead' ? 'Qualificado em' : 'Fechado em'}</TableHead>
              {kind === 'sale' && <TableHead className="text-right">Valor comercial</TableHead>}
              {kind === 'sale' && <TableHead>Tipo</TableHead>}
              <TableHead>Conta p/ meta?</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium max-w-[260px] truncate">{r.client_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.pipeline_name || '-'}</TableCell>
                <TableCell className="text-sm tabular-nums">{fmtDateTime(r.closed_at || r.sale_date)}</TableCell>
                {kind === 'sale' && (
                  <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(r.sale_value)}</TableCell>
                )}
                {kind === 'sale' && (
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{revenueType(r)}</Badge>
                  </TableCell>
                )}
                <TableCell>
                  {r.counts_toward_goal ? (
                    <Badge variant="default" className="text-xs">Sim</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs" title={r.exclusion_reason || ''}>
                      Não{r.exclusion_reason ? ` · ${r.exclusion_reason}` : ''}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.opportunity_id && (
                    <a
                      href={`/app/opportunities/${r.opportunity_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Abrir oportunidade"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
