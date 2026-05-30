import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, DollarSign, User } from 'lucide-react';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import { useOTESalesRecords } from '@/hooks/useOTESalesRecords';
import { useCommissionResults } from '@/hooks/useResultsByMode';
import { OTESellerSalesDrilldown } from '@/components/ote/OTESellerSalesDrilldown';

interface Props {
  results: OTEMonthlyResult[];
  isLoading: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function CommissionSellerDetailTab({ results, isLoading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const ids = results.map((r) => r.id);
  const { data: allRecords = [], isLoading: recordsLoading } = useOTESalesRecords(ids);
  const summary = useCommissionResults(results, allRecords);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (summary.rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma comissão calculada neste período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {summary.rows.map((row) => (
        <Card key={row.result.id}>
          <Collapsible
            open={expanded === row.result.id}
            onOpenChange={() => setExpanded(expanded === row.result.id ? null : row.result.id)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {row.result.profile?.full_name || 'Vendedor'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{row.result.level_name_snapshot || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Receita comissionável</p>
                      <p className="font-semibold">{fmtBRL(row.commissionableRevenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Comissão gerada</p>
                      <p className="font-bold text-primary">{fmtBRL(row.commissionGenerated)}</p>
                    </div>
                    {expanded === row.result.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <Metric label="Receita comissionável" value={fmtBRL(row.commissionableRevenue)} />
                  <Metric label="Receita não comissionável" value={fmtBRL(row.nonCommissionableRevenue)} />
                  <Metric label="Comissão paga" value={fmtBRL(row.commissionPaid)} accent="emerald" />
                  <Metric label="Comissão pendente" value={fmtBRL(row.commissionPending)} accent="amber" />
                  <Metric label="% Comissão média" value={`${row.avgCommissionRate.toFixed(1)}%`} />
                  <Metric label="Vendas com comissão" value={String(row.salesWithCommission)} />
                  <Metric label="Status" value={row.statusLabel} />
                  <Metric
                    label="Regra aplicada"
                    value={row.result.level_name_snapshot || 'Padrão'}
                    hint="Regras avançadas por produto/categoria seguem configuração de Vendas."
                  />
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Vendas e itens comissionáveis
                  </div>
                  <OTESellerSalesDrilldown
                    records={allRecords.filter((r) => r.ote_result_id === row.result.id)}
                    kind="sale"
                    loading={recordsLoading}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'amber';
  hint?: string;
}) {
  const color = accent === 'emerald' ? 'text-emerald-600' : accent === 'amber' ? 'text-amber-600' : '';
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
