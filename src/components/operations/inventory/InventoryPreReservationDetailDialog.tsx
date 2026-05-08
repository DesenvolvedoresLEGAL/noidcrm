import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, RefreshCw, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  AVAILABILITY_LABELS,
  ITEM_TYPE_LABELS,
  RISK_LABELS,
  STATUS_LABELS,
  availabilityBadgeVariant,
  riskBadgeVariant,
  statusBadgeVariant,
} from '@/lib/operations/inventoryPreReservations';
import {
  useCancelInventoryPreReservation,
  useInventoryPreReservation,
  useRecalculateInventoryPreReservation,
} from '@/hooks/operations/useInventoryPreReservations';

function fmt(v?: string | null) {
  if (!v) return '—';
  try {
    return format(new Date(v + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

interface Props {
  id: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function InventoryPreReservationDetailDialog({ id, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const q = useInventoryPreReservation(id);
  const recalc = useRecalculateInventoryPreReservation();
  const cancel = useCancelInventoryPreReservation();
  const r = q.data;

  const handleRecalc = async () => {
    if (!id) return;
    try {
      await recalc.mutateAsync(id);
      toast({ title: 'Disponibilidade recalculada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };
  const handleCancel = async () => {
    if (!id) return;
    if (!window.confirm('Cancelar esta pré reserva?')) return;
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Pré reserva cancelada' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {r?.reservation_code ?? 'Pré reserva'}
          </DialogTitle>
          <DialogDescription>{r?.title}</DialogDescription>
        </DialogHeader>

        {q.isLoading || !r ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={statusBadgeVariant(r.status)}>{STATUS_LABELS[r.status]}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risco</p>
                <Badge variant={riskBadgeVariant(r.risk_level)}>{RISK_LABELS[r.risk_level]}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Período operacional</p>
                <p>
                  {fmt(r.operational_start_date)} → {fmt(r.operational_end_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Evento</p>
                <p>
                  {r.event_start_date
                    ? `${fmt(r.event_start_date)} → ${fmt(r.event_end_date)}`
                    : '—'}
                </p>
              </div>
            </div>

            {r.notes && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p>{r.notes}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Itens</h4>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Pré reservado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Nenhum item.
                        </TableCell>
                      </TableRow>
                    ) : (
                      r.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">
                            {it.serialized_item?.name ||
                              it.quantity_item?.name ||
                              it.notes ||
                              it.category?.name ||
                              '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {ITEM_TYPE_LABELS[it.inventory_item_type]}
                          </TableCell>
                          <TableCell className="text-right">{Number(it.requested_quantity)}</TableCell>
                          <TableCell className="text-right">
                            {Number(it.pre_reserved_quantity)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={availabilityBadgeVariant(it.availability_status)}>
                              {AVAILABILITY_LABELS[it.availability_status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {it.conflict_reason ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleRecalc} disabled={!id || recalc.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recalcular
          </Button>
          {r?.status === 'active' && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
              <XCircle className="h-4 w-4 mr-2" /> Cancelar pré reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
