import { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Power, RotateCw, Save, Settings, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  daysUntil,
  tierStatusFromDates,
  TIER_STATUS_LABEL,
  type DynamicPricingTierInput,
  type TierStatus,
} from '@/lib/proposals/dynamicPricing';
import {
  useApplyProposalDynamicPrice,
  useCalculateProposalDynamicPrice,
  useDisableProposalDynamicPricing,
  useGenerateEventAntecedencePricing,
  useProposalDynamicPricing,
  useProposalDynamicPricingEvents,
  useProposalDynamicPricingSnapshot,
  useSaveProposalDynamicPricingRule,
} from '@/hooks/proposals/useProposalDynamicPricing';
import { DynamicPricingTierEditor } from './DynamicPricingTierEditor';
import { usePermissions } from '@/hooks/usePermissions';

interface Props {
  proposalId: string;
  proposalTotal?: number | null;
  inventoryAdjustedTotal?: number | null;
  eventStartDate?: string | null;
}

export function ProposalDynamicPricingPanel({
  proposalId,
  proposalTotal,
  inventoryAdjustedTotal,
  eventStartDate,
}: Props) {
  const { data, isLoading } = useProposalDynamicPricing(proposalId);
  const { data: snapshot } = useProposalDynamicPricingSnapshot(proposalId, !!data?.rule);
  const { data: events } = useProposalDynamicPricingEvents(proposalId);

  const save = useSaveProposalDynamicPricingRule(proposalId);
  const recalc = useCalculateProposalDynamicPrice(proposalId);
  const apply = useApplyProposalDynamicPrice(proposalId);
  const disableMut = useDisableProposalDynamicPricing(proposalId);
  const generate = useGenerateEventAntecedencePricing(proposalId);

  const perms = usePermissions();
  const isAdmin = perms?.isAdmin || perms?.isOwner || (perms as any)?.role === 'admin' || (perms as any)?.role === 'owner';

  const [enabled, setEnabled] = useState(true);
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [tiers, setTiers] = useState<DynamicPricingTierInput[]>([]);
  const [forceManual, setForceManual] = useState(false);

  const isAuto = data?.rule?.pricing_mode === 'event_antecedence';
  const showAutoMode = !forceManual && (isAuto || !!eventStartDate);

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

  // Auto-trigger generation: proposta com event_start_date e sem rule auto correspondente
  useEffect(() => {
    if (!showAutoMode) return;
    if (generate.isPending) return;
    if (!eventStartDate) return;
    const rule = data?.rule;
    if (!rule) {
      generate.mutate(false);
    } else if (
      rule.pricing_mode !== 'event_antecedence' ||
      rule.event_start_date !== eventStartDate
    ) {
      generate.mutate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAutoMode, eventStartDate, data?.rule?.id]);

  const overlap = useMemo(() => tiersOverlap(tiers), [tiers]);
  const isActive = !!data?.rule;
  const status = (snapshot?.status ?? data?.rule?.status ?? 'draft') as string;

  const onSaveManual = () => {
    save.mutate({
      enabled,
      base_amount: baseAmount,
      currency: 'BRL',
      notes: null,
      tiers: tiers.map((t, i) => ({ ...t, tier_order: i })),
    });
  };

  const eventDays = daysUntil(eventStartDate ?? data?.rule?.event_start_date);

  // Modo automático
  if (showAutoMode) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Tabela de Preço Dinâmica
              <Badge variant={statusBadgeVariant(status)}>
                {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
              </Badge>
              <Badge variant="outline">Modo automático por antecedência do evento</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Tabela e valor vigente são gerados automaticamente a partir da diferença entre a data de pagamento e o primeiro dia do evento.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForceManual(true)}
              className="text-xs"
            >
              Trocar para modo manual
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {!eventStartDate && !data?.rule?.event_start_date && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
              Defina a data de início do evento na proposta ou na oportunidade para gerar a tabela automaticamente.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metric label="Evento começa em" value={
              (eventStartDate ?? data?.rule?.event_start_date)
                ? new Date(eventStartDate ?? data!.rule!.event_start_date!).toLocaleDateString('pt-BR')
                : '—'
            } />
            <Metric label="Dias até o evento" value={eventDays != null ? String(eventDays) : '—'} />
            <Metric label="Valor base" value={formatBRL(data?.rule?.base_amount ?? baseAmount)} />
            <Metric label="Valor vigente" value={formatBRL(snapshot?.current_amount)} highlight />
            <Metric label="Próxima virada" value={formatBRL(snapshot?.next_amount)} subtitle={
              snapshot?.next_label && snapshot?.next_starts_at
                ? `${snapshot.next_label} em ${formatDateTime(snapshot.next_starts_at)}`
                : '—'
            } />
          </div>

          <Separator />

          <ReadOnlyTierTable
            tiers={data?.tiers ?? []}
            eventStartDate={eventStartDate ?? data?.rule?.event_start_date ?? null}
            currentTierId={snapshot?.current_tier_id ?? data?.rule?.current_tier_id ?? null}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={generate.isPending}
              onClick={() => generate.mutate(true)}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Recalcular tabela
            </Button>
            <Button
              variant="outline"
              disabled={!isActive || apply.isPending}
              onClick={() => apply.mutate()}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aplicar valor vigente
            </Button>
            {isAdmin && (
              <Button variant="ghost" asChild>
                <Link to="/settings/system/pricing-factor-rules">
                  <Settings className="h-4 w-4 mr-2" />
                  Ver configurações da regra
                </Link>
              </Button>
            )}
          </div>

          {events && events.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Eventos recentes ({events.length})
              </summary>
              <ul className="space-y-1 mt-2">
                {events.slice(0, 5).map((ev) => (
                  <li key={ev.id} className="rounded border p-2">
                    <div className="font-medium">{ev.event_type}</div>
                    <div className="text-muted-foreground">{ev.message}</div>
                    <div className="text-muted-foreground">{formatDateTime(ev.created_at)}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    );
  }

  // Modo manual (legado / admin override)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            Tabela de Preço Dinâmica
            <Badge variant={statusBadgeVariant(status)}>
              {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
            </Badge>
            <Badge variant="secondary">Modo manual</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Define valores válidos por período. O valor vigente é calculado pela data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {eventStartDate && isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForceManual(false)}
              className="text-xs"
            >
              Voltar para automático
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="pdp-enabled" className="text-xs">Ativar</Label>
            <Switch id="pdp-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Metric label="Valor base" value={formatBRL(baseAmount)} />
          <Metric label="Vigente hoje" value={formatBRL(snapshot?.current_amount)} subtitle={
            snapshot?.current_ends_at ? `até ${formatDateTime(snapshot.current_ends_at)}` : '—'
          } />
          <Metric label="Próxima virada" value={formatBRL(snapshot?.next_amount)} subtitle={
            snapshot?.next_label && snapshot?.next_starts_at
              ? `${snapshot.next_label} em ${formatDateTime(snapshot.next_starts_at)}`
              : '—'
          } />
        </div>

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

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSaveManual} disabled={save.isPending || overlap}>
            <Save className="h-4 w-4 mr-2" />
            Salvar tabela
          </Button>
          <Button variant="outline" disabled={!isActive || recalc.isPending} onClick={() => recalc.mutate()}>
            <Calculator className="h-4 w-4 mr-2" />
            Recalcular agora
          </Button>
          <Button variant="outline" disabled={!isActive || apply.isPending} onClick={() => apply.mutate()}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aplicar valor vigente
          </Button>
          {isActive && (
            <Button variant="ghost" disabled={disableMut.isPending} onClick={() => disableMut.mutate()}>
              <Power className="h-4 w-4 mr-2" />
              Desativar
            </Button>
          )}
        </div>

        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? 'border-primary bg-primary/5' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function ReadOnlyTierTable({
  tiers,
  eventStartDate,
  currentTierId,
}: {
  tiers: any[];
  eventStartDate: string | null;
  currentTierId: string | null;
}) {
  if (!tiers || tiers.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma faixa gerada ainda.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2">Faixa</th>
            <th className="text-left p-2">Período</th>
            <th className="text-right p-2">Ajuste</th>
            <th className="text-right p-2">Valor</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {tiers
            .slice()
            .sort((a, b) => (a.tier_order ?? 0) - (b.tier_order ?? 0))
            .map((t) => {
              const status: TierStatus =
                t.id === currentTierId
                  ? 'current'
                  : tierStatusFromDates(t.starts_at, t.ends_at, eventStartDate);
              const adj =
                t.adjustment_type === 'percent_adjustment'
                  ? `${Number(t.adjustment_value) >= 0 ? '+' : ''}${t.adjustment_value}%`
                  : t.adjustment_type === 'fixed_adjustment'
                  ? `${Number(t.adjustment_value) >= 0 ? '+' : ''}${formatBRL(t.adjustment_value)}`
                  : t.adjustment_type === 'fixed_price'
                  ? formatBRL(t.adjustment_value)
                  : '—';
              return (
                <tr key={t.id} className={status === 'current' ? 'bg-primary/5' : ''}>
                  <td className="p-2">{t.label}</td>
                  <td className="p-2">
                    {t.starts_at ? formatDateTime(t.starts_at) : '—'} →{' '}
                    {t.ends_at ? formatDateTime(t.ends_at) : 'sem fim'}
                  </td>
                  <td className="p-2 text-right">{adj}</td>
                  <td className="p-2 text-right font-medium">{formatBRL(t.final_amount)}</td>
                  <td className="p-2">
                    <Badge variant={status === 'current' ? 'default' : 'outline'}>
                      {TIER_STATUS_LABEL[status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
