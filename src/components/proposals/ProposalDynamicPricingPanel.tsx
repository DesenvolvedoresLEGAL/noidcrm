import { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Power, RotateCw, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  formatBRL,
  formatDateTime,
  STATUS_LABEL,
  statusBadgeVariant,
  tiersOverlap,
  type DynamicPricingTierInput,
} from '@/lib/proposals/dynamicPricing';
import {
  useApplyProposalDynamicPrice,
  useCalculateProposalDynamicPrice,
  useDisableProposalDynamicPricing,
  useProposalDynamicPricing,
  useProposalDynamicPricingEvents,
  useProposalDynamicPricingSnapshot,
  useSaveProposalDynamicPricingRule,
} from '@/hooks/proposals/useProposalDynamicPricing';
import { DynamicPricingTierEditor } from './DynamicPricingTierEditor';

interface Props {
  proposalId: string;
  proposalTotal?: number | null;
  inventoryAdjustedTotal?: number | null;
}

export function ProposalDynamicPricingPanel({
  proposalId,
  proposalTotal,
  inventoryAdjustedTotal,
}: Props) {
  const { data, isLoading } = useProposalDynamicPricing(proposalId);
  const { data: snapshot } = useProposalDynamicPricingSnapshot(
    proposalId,
    !!data?.rule,
  );
  const { data: events } = useProposalDynamicPricingEvents(proposalId);

  const save = useSaveProposalDynamicPricingRule(proposalId);
  const recalc = useCalculateProposalDynamicPrice(proposalId);
  const apply = useApplyProposalDynamicPrice(proposalId);
  const disableMut = useDisableProposalDynamicPricing(proposalId);

  const [enabled, setEnabled] = useState(true);
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [tiers, setTiers] = useState<DynamicPricingTierInput[]>([]);

  useEffect(() => {
    if (data?.rule) {
      setEnabled(data.rule.enabled);
      setBaseAmount(Number(data.rule.base_amount ?? 0));
      setTiers(
        data.tiers.map((t, i) => ({
          id: t.id,
          label: t.label,
          starts_at: t.starts_at,
          ends_at: t.ends_at,
          adjustment_type: t.adjustment_type,
          adjustment_value: Number(t.adjustment_value),
          tier_order: t.tier_order ?? i,
        })),
      );
    } else {
      setBaseAmount(Number(inventoryAdjustedTotal ?? proposalTotal ?? 0));
    }
  }, [data, inventoryAdjustedTotal, proposalTotal]);

  const overlap = useMemo(() => tiersOverlap(tiers), [tiers]);
  const isActive = !!data?.rule;
  const status = (snapshot?.status ?? data?.rule?.status ?? 'draft') as string;

  const onSave = () => {
    save.mutate({
      enabled,
      base_amount: baseAmount,
      currency: 'BRL',
      notes: null,
      tiers: tiers.map((t, i) => ({ ...t, tier_order: i })),
    });
  };

  const syncBaseFromInventory = () => {
    if (inventoryAdjustedTotal != null) setBaseAmount(Number(inventoryAdjustedTotal));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            Tabela de Preço Dinâmica
            <Badge variant={statusBadgeVariant(status)}>
              {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Define valores válidos por período. O valor vigente é calculado pela data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="pdp-enabled" className="text-xs">
            Ativar
          </Label>
          <Switch id="pdp-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Valor base</div>
            <div className="text-lg font-semibold">{formatBRL(baseAmount)}</div>
            {inventoryAdjustedTotal != null && (
              <Button
                variant="link"
                size="sm"
                className="px-0 h-auto"
                onClick={syncBaseFromInventory}
              >
                Sincronizar com fator INV
              </Button>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Vigente hoje</div>
            <div className="text-lg font-semibold">
              {formatBRL(snapshot?.current_amount)}
            </div>
            <div className="text-xs text-muted-foreground">
              {snapshot?.current_label ?? '—'} ·{' '}
              {snapshot?.current_ends_at
                ? `até ${formatDateTime(snapshot.current_ends_at)}`
                : 'sem fim'}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Próxima virada</div>
            <div className="text-lg font-semibold">
              {formatBRL(snapshot?.next_amount)}
            </div>
            <div className="text-xs text-muted-foreground">
              {snapshot?.next_label
                ? `${snapshot.next_label} em ${formatDateTime(snapshot.next_starts_at)}`
                : '—'}
            </div>
          </div>
        </div>

        {data?.rule?.last_calculated_at && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {formatDateTime(data.rule.last_calculated_at)}
          </p>
        )}

        {/* Editor */}
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Valor base</Label>
              <Input
                type="number"
                step="0.01"
                value={baseAmount}
                onChange={(e) => setBaseAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <DynamicPricingTierEditor
            baseAmount={baseAmount}
            tiers={tiers}
            onChange={setTiers}
          />
        </div>

        <Separator />

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={save.isPending || overlap}>
            <Save className="h-4 w-4 mr-2" />
            Salvar tabela
          </Button>
          <Button
            variant="outline"
            disabled={!isActive || recalc.isPending}
            onClick={() => recalc.mutate()}
          >
            <Calculator className="h-4 w-4 mr-2" />
            Recalcular agora
          </Button>
          <Button
            variant="outline"
            disabled={!isActive || apply.isPending}
            onClick={() => apply.mutate()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aplicar valor vigente
          </Button>
          {isActive && (
            <Button
              variant="ghost"
              disabled={disableMut.isPending}
              onClick={() => disableMut.mutate()}
            >
              <Power className="h-4 w-4 mr-2" />
              Desativar
            </Button>
          )}
        </div>

        {/* Eventos */}
        {events && events.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Eventos recentes
            </Label>
            <ul className="space-y-1 text-xs">
              {events.slice(0, 5).map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start justify-between gap-2 rounded border p-2"
                >
                  <div>
                    <div className="font-medium">{ev.event_type}</div>
                    <div className="text-muted-foreground">{ev.message}</div>
                  </div>
                  <div className="text-right text-muted-foreground whitespace-nowrap">
                    {formatDateTime(ev.created_at)}
                    {ev.new_amount != null && (
                      <div className="font-medium">{formatBRL(ev.new_amount)}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        )}
      </CardContent>
    </Card>
  );
}
