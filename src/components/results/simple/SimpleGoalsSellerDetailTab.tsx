import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Target, User } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import { useOTESalesRecords } from '@/hooks/useOTESalesRecords';
import { useSimpleGoalsResults } from '@/hooks/useResultsByMode';
import { OTESellerSalesDrilldown } from '@/components/ote/OTESellerSalesDrilldown';

interface Props {
  results: OTEMonthlyResult[];
  isLoading: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function SimpleGoalsSellerDetailTab({ results, isLoading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const ids = results.map((r) => r.id);
  const { data: allRecords = [], isLoading: recordsLoading } = useOTESalesRecords(ids);
  const summary = useSimpleGoalsResults(results, allRecords);

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
          Nenhum vendedor com meta configurada.
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
                      <CardTitle className="text-base">{row.result.profile?.full_name || 'Vendedor'}</CardTitle>
                      <p className="text-sm text-muted-foreground">{row.statusLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">% Meta</p>
                      <p className="font-semibold">{row.achievementPct.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Receita realizada</p>
                      <p className="font-bold text-primary">{fmtBRL(row.realized)}</p>
                    </div>
                    {expanded === row.result.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progresso da meta</span>
                    <span>{row.achievementPct.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(row.achievementPct, 100)} className="h-2" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <Metric label="Meta" value={fmtBRL(row.goal)} />
                  <Metric label="Receita realizada" value={fmtBRL(row.realized)} />
                  <Metric label="% Meta" value={`${row.achievementPct.toFixed(1)}%`} />
                  <Metric label="Gap para meta" value={fmtBRL(row.gap)} />
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    Vendas no período
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
