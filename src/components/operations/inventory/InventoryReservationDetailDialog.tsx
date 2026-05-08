import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  XCircle,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  RESERVATION_ITEM_STATUS_LABELS,
  RESERVATION_ITEM_TYPE_LABELS,
  RESERVATION_RISK_LABELS,
  RESERVATION_SOURCE_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_TRANSITIONS,
  reservationItemStatusBadgeVariant,
  reservationRiskBadgeVariant,
  reservationStatusBadgeVariant,
  type ReservationStatus,
} from '@/lib/operations/inventoryReservations';
import {
  useCancelInventoryReservation,
  useInventoryReservation,
  useUpdateInventoryReservationStatus,
} from '@/hooks/operations/useInventoryReservations';
import { useState } from 'react';

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

export function InventoryReservationDetailDialog({ id, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const q = useInventoryReservation(id);
  const updateStatus = useUpdateInventoryReservationStatus();
  const cancel = useCancelInventoryReservation();
  const r = q.data;
  const [pendingStatus, setPendingStatus] = useState<ReservationStatus | ''>('');

  const allowedNext = r ? RESERVATION_STATUS_TRANSITIONS[r.status] : [];

  const handleApplyStatus = async () => {
    if (!id || !pendingStatus || !r) return;
    try {
      await updateStatus.mutateAsync({
        id,
        status: pendingStatus,
        current: r.status,
      });
      toast({ title: 'Status atualizado' });
      setPendingStatus('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    if (!window.confirm('Cancelar esta reserva definitiva?')) return;
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Reserva cancelada' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const allocationsByItem: Record<string, any[]> = {};
  for (const a of r?.allocations ?? []) {
    if (!allocationsByItem[a.reservation_item_id]) allocationsByItem[a.reservation_item_id] = [];
    allocationsByItem[a.reservation_item_id].push(a);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            {r?.reservation_code ?? 'Reserva definitiva'}
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
                <Badge variant={reservationStatusBadgeVariant(r.status)}>
                  {RESERVATION_STATUS_LABELS[r.status]}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risco</p>
                <Badge variant={reservationRiskBadgeVariant(r.risk_level)}>
                  {RESERVATION_RISK_LABELS[r.risk_level]}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <p>{RESERVATION_SOURCE_LABELS[r.source]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Confirmada em</p>
                <p>{r.confirmed_at ? fmt(r.confirmed_at.slice(0, 10)) : '—'}</p>
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
              <div>
                <p className="text-xs text-muted-foreground">Pré reserva de origem</p>
                <p className="font-mono text-xs">{r.pre_reservation_id ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gatilho</p>
                <p>{r.confirmation_trigger}</p>
              </div>
            </div>

            {r.notes && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p>{r.notes}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Itens reservados</h4>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Demanda</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Família</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                          Nenhum item.
                        </TableCell>
                      </TableRow>
                    ) : (
                      r.items.map((it: any) => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">
                            {it.demand_label ||
                              it.serialized_item?.name ||
                              it.quantity_item?.name ||
                              '—'}
                          </TableCell>
                          <TableCell className="text-xs">{it.category?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs">{it.family?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs">
                            {RESERVATION_ITEM_TYPE_LABELS[it.inventory_item_type as keyof typeof RESERVATION_ITEM_TYPE_LABELS]}
                          </TableCell>
                          <TableCell className="text-right">{Number(it.requested_quantity)}</TableCell>
                          <TableCell className="text-right">{Number(it.reserved_quantity)}</TableCell>
                          <TableCell>
                            <Badge variant={reservationItemStatusBadgeVariant(it.reservation_status)}>
                              {RESERVATION_ITEM_STATUS_LABELS[it.reservation_status as keyof typeof RESERVATION_ITEM_STATUS_LABELS]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Itens alocados</h4>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(r.allocations ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          Nenhuma alocação.
                        </TableCell>
                      </TableRow>
                    ) : (
                      r.allocations.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">
                            {a.serialized_item?.name || a.quantity_item?.name || '—'}
                            {a.serialized_item?.asset_code ? (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({a.serialized_item.asset_code})
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs">{a.allocation_item_type}</TableCell>
                          <TableCell className="text-right">{Number(a.allocated_quantity)}</TableCell>
                          <TableCell>
                            <Badge variant={a.allocation_status === 'active' ? 'default' : 'outline'}>
                              {a.allocation_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {allowedNext.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Mudar status para:</span>
                <Select value={pendingStatus} onValueChange={(v) => setPendingStatus(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedNext.map((s) => (
                      <SelectItem key={s} value={s}>
                        {RESERVATION_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleApplyStatus}
                  disabled={!pendingStatus || updateStatus.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aplicar
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
          </Button>
          {r && (r.status === 'confirmed' || r.status === 'in_preparation') && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
              <XCircle className="h-4 w-4 mr-2" /> Cancelar reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
