import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronDown, ChevronRight, PackagePlus, RefreshCw, Trash2, XCircle } from 'lucide-react';
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
  ALLOCATION_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  RISK_LABELS,
  STATUS_LABELS,
  allocationStatusBadgeVariant,
  riskBadgeVariant,
  statusBadgeVariant,
} from '@/lib/operations/inventoryPreReservations';
import {
  useCancelInventoryPreReservation,
  useDeletePreReservationItem,
  useInventoryPreReservation,
  useRecalculateInventoryPreReservation,
} from '@/hooks/operations/useInventoryPreReservations';
import { InventoryAllocationDialog } from './InventoryAllocationDialog';
import { InventoryAllocatedItemsList } from './InventoryAllocatedItemsList';

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
  const del = useDeletePreReservationItem();
  const r = q.data;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allocItemId, setAllocItemId] = useState<string | null>(null);

  const toggle = (itemId: string) =>
    setExpanded((p) => ({ ...p, [itemId]: !p[itemId] }));

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
  const handleRemove = async (itemId: string) => {
    if (!window.confirm('Remover esta demanda?')) return;
    try {
      await del.mutateAsync(itemId);
      toast({ title: 'Demanda removida' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
              <h4 className="text-sm font-semibold mb-2">Demandas e alocação</h4>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Demanda</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Família</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Alocado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                          Nenhuma demanda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      r.items.map((it: any) => (
                        <>
                          <TableRow key={it.id}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggle(it.id)}
                              >
                                {expanded[it.id] ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">
                              {it.demand_label ||
                                it.serialized_item?.name ||
                                it.quantity_item?.name ||
                                it.notes ||
                                '—'}
                            </TableCell>
                            <TableCell className="text-xs">{it.category?.name ?? '—'}</TableCell>
                            <TableCell className="text-xs">{it.family?.name ?? '—'}</TableCell>
                            <TableCell className="text-xs">
                              {ITEM_TYPE_LABELS[it.inventory_item_type as keyof typeof ITEM_TYPE_LABELS]}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(it.requested_quantity)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(it.allocated_quantity ?? 0)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={allocationStatusBadgeVariant(it.allocation_status)}>
                                {ALLOCATION_STATUS_LABELS[it.allocation_status as keyof typeof ALLOCATION_STATUS_LABELS]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAllocItemId(it.id)}
                              >
                                <PackagePlus className="h-3.5 w-3.5 mr-1" /> Alocar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemove(it.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expanded[it.id] && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30">
                                <InventoryAllocatedItemsList preReservationItemId={it.id} />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
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

        <InventoryAllocationDialog
          open={!!allocItemId}
          onOpenChange={(o) => !o && setAllocItemId(null)}
          preReservationId={id}
          preReservationItemId={allocItemId}
        />
      </DialogContent>
    </Dialog>
  );
}
