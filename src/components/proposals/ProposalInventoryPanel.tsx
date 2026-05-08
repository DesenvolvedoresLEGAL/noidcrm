import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  PackageSearch,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { InventoryAvailabilitySnapshotDialog } from '@/components/operations/inventory/InventoryAvailabilitySnapshotDialog';
import {
  RISK_LABELS,
  STATUS_LABELS,
  riskBadgeVariant,
  statusBadgeVariant,
} from '@/lib/operations/inventoryPreReservations';
import {
  useCancelInventoryPreReservation,
  useProposalPreReservations,
  useRecalculateInventoryPreReservation,
} from '@/hooks/operations/useInventoryPreReservations';
import {
  useConvertPreReservationToReservation,
  useProposalReservations,
} from '@/hooks/operations/useInventoryReservations';
import {
  RESERVATION_STATUS_LABELS,
  reservationStatusBadgeVariant,
} from '@/lib/operations/inventoryReservations';
import { GeneratePreReservationDialog } from './GeneratePreReservationDialog';
import { ProposalCapacityImpactBlock } from './ProposalCapacityImpactBlock';

function fmt(v?: string | null) {
  if (!v) return '—';
  try {
    return format(new Date(v + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

interface Props {
  proposalId?: string | null;
  closeDatePrevista?: string | null;
}

export function ProposalInventoryPanel({ proposalId, closeDatePrevista }: Props) {
  const { toast } = useToast();
  const [genOpen, setGenOpen] = useState(false);
  const list = useProposalPreReservations(proposalId);
  const reservationsList = useProposalReservations(proposalId);
  const recalc = useRecalculateInventoryPreReservation();
  const cancel = useCancelInventoryPreReservation();
  const convert = useConvertPreReservationToReservation();

  if (!proposalId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground text-center">
          Salve a proposta para gerar pré reserva de inventário.
        </CardContent>
      </Card>
    );
  }

  const reservations = list.data ?? [];
  const active = reservations.find((r) => r.status === 'active');
  const definitive = (reservationsList.data ?? []).find(
    (r: any) => r.status !== 'cancelled',
  );

  const items = (active as any)?.items ?? [];
  const conflicts = items.filter((i: any) =>
    ['partial', 'unavailable'].includes(i.availability_status),
  ).length;
  const allocatedCount = items.filter((i: any) => i.allocation_status === 'allocated').length;
  const partialCount = items.filter((i: any) => i.allocation_status === 'partially_allocated').length;
  const pendingCount = items.filter((i: any) => i.allocation_status === 'unallocated').length;
  const pendingDemands = items.filter(
    (i: any) =>
      i.inventory_item_type !== 'service_no_stock' &&
      Number(i.allocated_quantity ?? 0) < Number(i.requested_quantity ?? 0),
  ).length;
  const canConvert = !!active && pendingDemands === 0 && !definitive;

  const handleConvert = async () => {
    if (!active) return;
    try {
      const res = await convert.mutateAsync({
        pre_reservation_id: active.id,
        confirmation_trigger: 'manual',
      });
      if (!res.success) {
        toast({
          title: 'Não foi possível converter',
          description: res.message ?? res.reason,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Reserva definitiva criada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleRecalc = async () => {
    if (!active) return;
    try {
      await recalc.mutateAsync(active.id);
      toast({ title: 'Disponibilidade recalculada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };
  const handleCancel = async () => {
    if (!active) return;
    if (!window.confirm('Cancelar pré reserva?')) return;
    try {
      await cancel.mutateAsync(active.id);
      toast({ title: 'Pré reserva cancelada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageSearch className="h-4 w-4" /> Inventário da proposta
          </CardTitle>
          <CardDescription>
            Pré reserva operacional (segurança comercial). Não altera o status físico dos itens.
          </CardDescription>
        </div>
        <InventoryAvailabilitySnapshotDialog
          defaultStart={active?.operational_start_date ?? undefined}
          defaultEnd={active?.operational_end_date ?? undefined}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {list.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !active ? (
          <div className="rounded-md border border-dashed p-4 flex flex-col items-center text-center gap-2">
            <CalendarRange className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Esta proposta ainda não possui pré reserva de inventário.
            </p>
            <Button size="sm" onClick={() => setGenOpen(true)}>
              Gerar pré reserva de inventário
            </Button>
          </div>
        ) : (
          <>
            {conflicts > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Existem itens indisponíveis no período</AlertTitle>
                <AlertDescription>
                  {conflicts} item(ns) com conflito de disponibilidade. Recalcule ou ajuste a
                  proposta.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Pré reserva ativa</AlertTitle>
                <AlertDescription>Nenhum conflito de disponibilidade no período.</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-mono">{active.reservation_code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Período</p>
                <p>
                  {fmt(active.operational_start_date)} → {fmt(active.operational_end_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={statusBadgeVariant(active.status)}>
                  {STATUS_LABELS[active.status]}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risco</p>
                <Badge variant={riskBadgeVariant(active.risk_level)}>
                  {RISK_LABELS[active.risk_level]}
                </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border p-2 text-center">
                <p className="text-muted-foreground">Alocadas</p>
                <p className="font-semibold text-base">{allocatedCount}</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-muted-foreground">Parciais</p>
                <p className="font-semibold text-base">{partialCount}</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-muted-foreground">Pendentes</p>
                <p className="font-semibold text-base">{pendingCount}</p>
              </div>
            </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleRecalc} disabled={recalc.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" /> Recalcular
              </Button>
              {!definitive && (
                <Button
                  size="sm"
                  onClick={handleConvert}
                  disabled={!canConvert || convert.isPending}
                  title={
                    !canConvert
                      ? pendingDemands > 0
                        ? `${pendingDemands} demanda(s) pendentes`
                        : 'Indisponível'
                      : undefined
                  }
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Converter em reserva definitiva
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/app/operations/inventory', '_blank')}
              >
                Ver no Inventário
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancel.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" /> Cancelar
              </Button>
            </div>

            {definitive && (
              <div className="rounded-md border p-3 bg-muted/30 mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Reserva definitiva</p>
                  <Badge variant={reservationStatusBadgeVariant(definitive.status as any)}>
                    {RESERVATION_STATUS_LABELS[definitive.status as keyof typeof RESERVATION_STATUS_LABELS]}
                  </Badge>
                </div>
                <p className="font-mono text-sm">{definitive.reservation_code}</p>
                <p className="text-xs text-muted-foreground">
                  Período: {fmt(definitive.operational_start_date)} → {fmt(definitive.operational_end_date)}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-muted-foreground">Itens</p>
                    <p className="font-semibold">{(definitive as any).items?.length ?? 0}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-muted-foreground">Saída</p>
                    <p className="font-semibold">
                      {['dispatched', 'in_operation', 'returned', 'closed'].includes(definitive.status)
                        ? 'OK'
                        : 'pendente'}
                    </p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-muted-foreground">Retorno</p>
                    <p className="font-semibold">
                      {['returned', 'closed'].includes(definitive.status) ? 'OK' : 'pendente'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <GeneratePreReservationDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        proposalId={proposalId}
        defaultDate={closeDatePrevista ?? null}
      />

      {active && items.length > 0 && (
        <CardContent className="pt-0">
          <ProposalCapacityImpactBlock
            proposalId={proposalId}
            operationalStartDate={active.operational_start_date}
            operationalEndDate={active.operational_end_date}
            items={items}
          />
        </CardContent>
      )}
    </Card>
  );
}
