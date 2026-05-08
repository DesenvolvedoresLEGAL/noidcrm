import { useMemo, useState } from 'react';
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  calculatePricingFactor,
  type InventoryPricingRule,
} from '@/services/operations/inventoryPricing';
import {
  formatBRL,
  formatPercent,
  RISK_LABEL,
  riskBadgeVariant,
  type InventoryPricingFactorResult,
  type PricingRisk,
} from '@/lib/operations/inventoryPricing';

interface PreReservationItemLike {
  id: string;
  category_id: string | null;
  family_id: string | null;
  requested_quantity: number;
  proposal_item_id: string | null;
  inventory_item_type?: string | null;
  demand_label?: string | null;
}

interface Props {
  proposalId: string;
  operationalStartDate: string;
  operationalEndDate: string;
  items: PreReservationItemLike[];
}

export function ProposalCapacityImpactBlock({
  proposalId,
  operationalStartDate,
  operationalEndDate,
  items,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [applying, setApplying] = useState(false);

  // Fetch proposal items to get base price + name + discount
  const proposalItemsQuery = useQueries({
    queries: items
      .filter((i) => i.proposal_item_id)
      .map((i) => ({
        queryKey: ['proposal-item', i.proposal_item_id],
        queryFn: async () => {
          const { data } = await (supabase as any)
            .from('proposal_items')
            .select('id,name,unit_price,quantity,discount_percent,total,inventory_pricing_snapshot,inventory_risk_level,inventory_adjustment_amount')
            .eq('id', i.proposal_item_id)
            .maybeSingle();
          return data;
        },
        staleTime: 30_000,
      })),
  });

  const proposalItemsMap = useMemo(() => {
    const m = new Map<string, any>();
    proposalItemsQuery.forEach((q) => {
      const d = q.data as any;
      if (d) m.set(d.id, d);
    });
    return m;
  }, [proposalItemsQuery]);

  // Per-item factor query
  const factorsQuery = useQueries({
    queries: items.map((i) => {
      const pi = i.proposal_item_id ? proposalItemsMap.get(i.proposal_item_id) : null;
      const baseAmount =
        pi != null
          ? Number(pi.unit_price ?? 0) * Number(pi.quantity ?? i.requested_quantity ?? 1)
          : 0;
      return {
        queryKey: [
          'inventory', 'pricing', 'factor',
          i.id, operationalStartDate, operationalEndDate, i.category_id, i.family_id, i.requested_quantity, baseAmount,
        ],
        queryFn: () =>
          calculatePricingFactor({
            start_date: operationalStartDate,
            end_date: operationalEndDate,
            category_id: i.category_id,
            family_id: i.family_id,
            requested_quantity: i.requested_quantity || 1,
            base_amount: baseAmount,
          }),
        enabled: !!operationalStartDate && !!operationalEndDate && pi != null,
        staleTime: 30_000,
      };
    }),
  });

  const rows = items.map((item, idx) => {
    const pi = item.proposal_item_id ? proposalItemsMap.get(item.proposal_item_id) : null;
    const factor = factorsQuery[idx]?.data as InventoryPricingFactorResult | undefined;
    return { item, pi, factor };
  });

  const summary = useMemo(() => {
    let totalBase = 0;
    let totalAdjusted = 0;
    let totalAdjustment = 0;
    let weightedOcc = 0;
    let totalWeight = 0;
    let highest: PricingRisk = 'low';
    const rank: Record<PricingRisk, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    let requiresApproval = false;
    const discountIssues: string[] = [];
    rows.forEach(({ pi, factor, item }) => {
      if (!factor || !pi) return;
      totalBase += factor.base_amount;
      totalAdjusted += factor.adjusted_amount;
      totalAdjustment += factor.adjustment_amount;
      weightedOcc += factor.occupancy_rate * Math.max(factor.base_amount, 1);
      totalWeight += Math.max(factor.base_amount, 1);
      if (rank[factor.risk_level] > rank[highest]) highest = factor.risk_level;
      if (factor.requires_approval) requiresApproval = true;
      const dp = Number(pi.discount_percent ?? 0);
      if (
        factor.max_discount_percent != null &&
        dp > Number(factor.max_discount_percent)
      ) {
        discountIssues.push(
          `${pi.name ?? item.demand_label ?? 'Item'}: desconto ${dp}% acima do permitido (${factor.max_discount_percent}%).`,
        );
      }
    });
    return {
      totalBase,
      totalAdjusted,
      totalAdjustment,
      avgOccupancy: totalWeight > 0 ? weightedOcc / totalWeight : 0,
      highest,
      requiresApproval,
      discountIssues,
    };
  }, [rows]);

  const apply = useMutation({
    mutationFn: async () => {
      setApplying(true);
      for (const { item, pi, factor } of rows) {
        if (!pi || !factor || !item.proposal_item_id) continue;
        const qty = Number(pi.quantity ?? item.requested_quantity ?? 1);
        const adjustedUnit = qty > 0 ? Number((factor.adjusted_amount / qty).toFixed(2)) : null;
        await (supabase as any)
          .from('proposal_items')
          .update({
            inventory_occupancy_rate: factor.occupancy_rate,
            inventory_pricing_factor: factor.price_adjustment_value,
            inventory_adjustment_amount: factor.adjustment_amount,
            inventory_adjusted_unit_price: adjustedUnit,
            inventory_risk_level: factor.risk_level,
            inventory_pricing_snapshot: { ...factor, applied_at: new Date().toISOString() },
          })
          .eq('id', item.proposal_item_id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Fator de ocupação aplicado em todos os itens.' });
      qc.invalidateQueries({ queryKey: ['proposal-item'] });
      qc.invalidateQueries({ queryKey: ['proposal-items'] });
    },
    onError: (e: any) =>
      toast({ title: 'Falha ao aplicar', description: e?.message, variant: 'destructive' }),
    onSettled: () => setApplying(false),
  });

  if (!items.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Inteligência de capacidade
          </CardTitle>
          <CardDescription>
            Impacto da ocupação do estoque no valor da proposta no período operacional.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => apply.mutate()}
          disabled={applying || rows.every(({ factor }) => !factor)}
        >
          {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Aplicar fator de ocupação
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.discountIssues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Desconto acima do permitido</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 text-xs space-y-1">
                {summary.discountIssues.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Ocupação média</p>
            <p className="text-lg font-semibold">{formatPercent(summary.avgOccupancy)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Maior risco</p>
            <Badge variant={riskBadgeVariant(summary.highest)}>
              {RISK_LABEL[summary.highest]}
            </Badge>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Valor base</p>
            <p className="text-lg font-semibold">{formatBRL(summary.totalBase)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Ajuste por ocupação</p>
            <p className="text-lg font-semibold">{formatBRL(summary.totalAdjustment)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Valor ajustado</p>
            <p className="text-lg font-semibold">{formatBRL(summary.totalAdjusted)}</p>
            {summary.requiresApproval && (
              <p className="text-xs text-destructive mt-1">Aprovação necessária</p>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Ocupação</TableHead>
              <TableHead>Fator</TableHead>
              <TableHead>Risco</TableHead>
              <TableHead>Disp/Dem</TableHead>
              <TableHead>Base → Ajustado</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ item, pi, factor }) => {
              const applied = pi?.inventory_pricing_snapshot && Object.keys(pi.inventory_pricing_snapshot).length > 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {pi?.name ?? item.demand_label ?? '—'}
                  </TableCell>
                  <TableCell>
                    {factor ? formatPercent(factor.occupancy_rate) : '—'}
                  </TableCell>
                  <TableCell>
                    {factor
                      ? factor.price_adjustment_type === 'percent'
                        ? `+${factor.price_adjustment_value}%`
                        : `+${formatBRL(factor.price_adjustment_value)}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {factor && (
                      <Badge variant={riskBadgeVariant(factor.risk_level)}>
                        {RISK_LABEL[factor.risk_level as PricingRisk]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {factor
                      ? `${factor.available_quantity} / ${factor.requested_quantity}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {factor
                      ? `${formatBRL(factor.base_amount)} → ${formatBRL(factor.adjusted_amount)}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={applied ? 'default' : 'outline'}>
                      {applied ? 'Aplicado' : factor?.adjustment_amount ? 'Sugerido' : 'Sem ajuste'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
