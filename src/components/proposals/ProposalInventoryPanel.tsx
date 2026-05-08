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
import { GeneratePreReservationDialog } from './GeneratePreReservationDialog';

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
  const recalc = useRecalculateInventoryPreReservation();
  const cancel = useCancelInventoryPreReservation();

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

  const items = (active as any)?.items ?? [];
  const conflicts = items.filter((i: any) =>
    ['partial', 'unavailable'].includes(i.availability_status),
  ).length;
  const allocatedCount = items.filter((i: any) => i.allocation_status === 'allocated').length;
  const partialCount = items.filter((i: any) => i.allocation_status === 'partially_allocated').length;
  const pendingCount = items.filter((i: any) => i.allocation_status === 'unallocated').length;

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
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PackageSearch className="h-4 w-4" /> Inventário da proposta
        </CardTitle>
        <CardDescription>
          Pré reserva operacional (segurança comercial). Não altera o status físico dos itens.
        </CardDescription>
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
          </>
        )}
      </CardContent>

      <GeneratePreReservationDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        proposalId={proposalId}
        defaultDate={closeDatePrevista ?? null}
      />
    </Card>
  );
}
