import { useState, Fragment } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  OTESalesRecord,
  OTESalesRecordItem,
} from '@/hooks/useOTESalesRecords';
import { resolveEligibleAmounts } from './oteEligibility';

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

function ItemsTable({ items }: { items: OTESalesRecordItem[] }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Sem itens vinculados a esta proposta — valor cheio considerado para meta.
      </p>
    );
  }
  return (
    <div className="rounded-md border bg-muted/30">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Produto / serviço</TableHead>
            <TableHead className="text-xs">Tipo</TableHead>
            <TableHead className="text-xs text-right">Qtd</TableHead>
            <TableHead className="text-xs text-right">Valor do item</TableHead>
            <TableHead className="text-xs">Conta p/ meta?</TableHead>
            <TableHead className="text-xs text-right">Valor elegível</TableHead>
            <TableHead className="text-xs">Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => {
            const lineAmount = Number(it.line_amount) || 0;
            const eligible = it.counts_toward_goal ? lineAmount : 0;
            return (
              <TableRow key={it.id}>
                <TableCell className="text-sm">{it.product_name || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(it.billing_type || '').toLowerCase() === 'recurring' ? 'Recorrente' : 'One-shot'}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {Number(it.quantity || 0)}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {fmtBRL(lineAmount)}
                </TableCell>
                <TableCell>
                  {it.counts_toward_goal ? (
                    <Badge variant="default" className="text-xs">Sim</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Não</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {fmtBRL(eligible)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                  {it.exclusion_reason || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function OTESellerSalesDrilldown({ records, kind, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const eligibleTotal = records.reduce((s, r) => s + resolveEligibleAmounts(r).eligible, 0);
  const nonEligibleTotal = records.reduce((s, r) => s + resolveEligibleAmounts(r).nonEligible, 0);
  const ssotTotal = records.reduce((s, r) => s + Number(r.sale_value || 0), 0);

  // Colunas da tabela (kind === 'sale'):
  // [▸] Cliente | Pipeline | Fechado em | Valor comercial | Elegível p/ meta | Tipo | Ações
  // kind === 'qualified_lead' fica mais simples: [▸] Cliente | Pipeline | Qualificado em | Status | Ações
  const colSpan = kind === 'sale' ? 8 : 6;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h5 className="text-sm font-semibold">
            {kind === 'qualified_lead'
              ? `Leads qualificados (${records.length})`
              : `Vendas no período (${records.length})`}
          </h5>
          <div className="text-xs text-muted-foreground flex gap-4 flex-wrap items-center">
            {kind === 'sale' && (
              <span>
                Receita (SSoT):{' '}
                <strong className="text-foreground">{fmtBRL(ssotTotal)}</strong>
              </span>
            )}
            <span>
              Elegível para meta:{' '}
              <strong className="text-foreground">
                {kind === 'qualified_lead' ? `${records.length} leads` : fmtBRL(eligibleTotal)}
              </strong>
            </span>
            {nonEligibleTotal > 0.01 && (
              <span>
                Fora da meta:{' '}
                <strong className="text-foreground">{fmtBRL(nonEligibleTotal)}</strong>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Inclui (a) vendas reabertas/perdidas e (b) produtos/serviços
                    cuja flag "Contabiliza na meta" está desligada no catálogo.
                    Expanda a linha para auditar item a item.
                  </TooltipContent>
                </Tooltip>
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Cliente / Oportunidade</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>{kind === 'qualified_lead' ? 'Qualificado em' : 'Fechado em'}</TableHead>
                {kind === 'sale' && <TableHead className="text-right">Valor comercial</TableHead>}
                {kind === 'sale' && <TableHead className="text-right">Elegível p/ meta</TableHead>}
                {kind === 'sale' && <TableHead>Tipo</TableHead>}
                {kind === 'qualified_lead' && <TableHead>Status</TableHead>}
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const isOpen = expanded === r.id;
                const hasItems = (r.items?.length || 0) > 0;
                const canExpand =
                  kind === 'sale' && (hasItems || (r.exclusion_reason ?? null) !== null);
                const { eligible } = resolveEligibleAmounts(r);
                const sale = Number(r.sale_value) || 0;
                const partial = kind === 'sale' && sale > 0 && eligible + 0.01 < sale;
                return (
                  <Fragment key={r.id}>
                    <TableRow>
                      <TableCell>
                        {canExpand && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setExpanded(isOpen ? null : r.id)}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[260px] truncate">
                        {r.client_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.pipeline_name || '-'}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {fmtDateTime(r.closed_at || r.sale_date)}
                      </TableCell>
                      {kind === 'sale' && (
                        <TableCell className="text-right tabular-nums font-semibold">
                          {fmtBRL(sale)}
                        </TableCell>
                      )}
                      {kind === 'sale' && (
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            partial && 'text-amber-600 font-medium',
                          )}
                        >
                          {fmtBRL(eligible)}
                        </TableCell>
                      )}
                      {kind === 'sale' && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {revenueType(r)}
                          </Badge>
                        </TableCell>
                      )}
                      {kind === 'qualified_lead' && (
                        <TableCell>
                          {r.counts_toward_goal ? (
                            <Badge variant="default" className="text-xs">Conta p/ meta</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Não conta{r.exclusion_reason ? ` · ${r.exclusion_reason}` : ''}
                            </Badge>
                          )}
                        </TableCell>
                      )}
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
                    {isOpen && canExpand && (
                      <TableRow className={cn('bg-muted/20')}>
                        <TableCell colSpan={colSpan} className="py-3">
                          <div className="space-y-2">
                            {r.exclusion_reason && (
                              <p className="text-xs text-muted-foreground">
                                <Info className="inline h-3 w-3 mr-1" />
                                {r.exclusion_reason}
                              </p>
                            )}
                            <ItemsTable items={r.items || []} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
