import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle2,
  Circle,
  History,
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
import { Textarea } from '@/components/ui/textarea';
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
  ALLOCATION_OPERATIONAL_STATUS_LABELS,
  OPERATION_EVENT_LABELS,
  RESERVATION_ITEM_STATUS_LABELS,
  RESERVATION_ITEM_TYPE_LABELS,
  RESERVATION_RISK_LABELS,
  RESERVATION_SOURCE_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_TRANSITIONS,
  RETURN_CONDITIONS,
  RETURN_CONDITION_LABELS,
  allocationOperationalStatusBadgeVariant,
  reservationItemStatusBadgeVariant,
  reservationRiskBadgeVariant,
  reservationStatusBadgeVariant,
  type AllocationOperationalStatus,
  type ReservationStatus,
  type ReturnCondition,
} from '@/lib/operations/inventoryReservations';
import {
  useCancelInventoryReservation,
  useInventoryOperationEvents,
  useInventoryReservation,
  useSetInventoryReturnCondition,
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

function fmtDateTime(v?: string | null) {
  if (!v) return '—';
  try {
    return format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

interface Props {
  id: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const TIMELINE_STEPS: ReservationStatus[] = [
  'confirmed',
  'in_preparation',
  'dispatched',
  'in_operation',
  'returned',
  'closed',
];

export function InventoryReservationDetailDialog({ id, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const q = useInventoryReservation(id);
  const events = useInventoryOperationEvents(id);
  const updateStatus = useUpdateInventoryReservationStatus();
  const cancel = useCancelInventoryReservation();
  const setReturnCond = useSetInventoryReturnCondition();
  const r = q.data;
  const [pendingStatus, setPendingStatus] = useState<ReservationStatus | ''>('');
  const [transitionNotes, setTransitionNotes] = useState('');

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
      setTransitionNotes('');
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

  const handleSetReturnCondition = async (
    allocationId: string,
    condition: ReturnCondition,
    notes?: string,
  ) => {
    try {
      await setReturnCond.mutateAsync({
        reservation_allocation_id: allocationId,
        return_condition: condition,
        return_notes: notes ?? null,
      });
      toast({ title: 'Condição registrada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  // Compute timeline data from events
  const statusEvents = (events.data ?? []).filter(
    (e) => e.event_type === 'reservation_status_changed',
  );
  const timelineMap = new Map<string, { at: string; notes: string | null }>();
  for (const ev of [...statusEvents].reverse()) {
    if (ev.to_status) timelineMap.set(ev.to_status, { at: ev.created_at, notes: ev.notes });
  }

  const allocations = (r?.allocations ?? []) as any[];
  const returnedAllocations = allocations.filter(
    (a) => ['returned', 'released', 'damaged', 'lost', 'maintenance'].includes(a.operational_status),
  );
  const pendingReturnConditions = allocations.filter(
    (a) => a.operational_status === 'returned' && !a.return_condition,
  ).length;
  const canClose = r?.status === 'returned' && pendingReturnConditions === 0;

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

            {/* OPERAÇÃO FÍSICA — TIMELINE */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Operação física</h4>
              <div className="rounded-md border p-4">
                <ol className="flex flex-wrap gap-3">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const reached =
                      r.status === 'cancelled'
                        ? false
                        : TIMELINE_STEPS.indexOf(r.status as ReservationStatus) >= idx;
                    const isCurrent = r.status === step;
                    const ev = timelineMap.get(step);
                    return (
                      <li
                        key={step}
                        className={`flex-1 min-w-[140px] rounded-md border p-3 ${
                          isCurrent
                            ? 'border-primary bg-primary/5'
                            : reached
                              ? 'border-emerald-500/40 bg-emerald-500/5'
                              : 'border-dashed'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          {reached ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {RESERVATION_STATUS_LABELS[step]}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {ev ? fmtDateTime(ev.at) : '—'}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

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
                      <TableHead>Status operacional</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Retorno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Nenhuma alocação.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allocations.map((a: any) => {
                        const opStatus = (a.operational_status ?? 'pending') as AllocationOperationalStatus;
                        return (
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
                              <Badge variant={allocationOperationalStatusBadgeVariant(opStatus)}>
                                {ALLOCATION_OPERATIONAL_STATUS_LABELS[opStatus]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {a.dispatched_at ? fmtDateTime(a.dispatched_at) : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {a.returned_at ? fmtDateTime(a.returned_at) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* CHECKLIST DE RETORNO */}
            {r.status === 'returned' && returnedAllocations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Checklist de retorno</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Classifique a condição de cada item retornado para liberar o fechamento.
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead>Condição</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnedAllocations.map((a: any) => (
                        <ReturnConditionRow
                          key={a.id}
                          allocation={a}
                          onSave={handleSetReturnCondition}
                          disabled={setReturnCond.isPending}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {pendingReturnConditions > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    {pendingReturnConditions} item(ns) ainda sem condição de retorno.
                  </p>
                )}
              </div>
            )}

            {/* HISTÓRICO OPERACIONAL */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico operacional
              </h4>
              <div className="overflow-x-auto rounded-md border max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Tipo item</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : (events.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          Sem eventos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (events.data ?? []).map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {fmtDateTime(ev.created_at)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {OPERATION_EVENT_LABELS[ev.event_type] ?? ev.event_type}
                            {ev.from_status && ev.to_status && (
                              <span className="text-muted-foreground ml-1">
                                ({ev.from_status} → {ev.to_status})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{ev.allocation_item_type ?? '—'}</TableCell>
                          <TableCell className="text-right text-xs">{Number(ev.quantity)}</TableCell>
                          <TableCell className="text-xs">{ev.notes ?? '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {allowedNext.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avançar para:</span>
                  <Select value={pendingStatus} onValueChange={(v) => setPendingStatus(v as any)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNext.map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          disabled={s === 'closed' && !canClose}
                        >
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
                <Textarea
                  placeholder="Observação (opcional)"
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  className="text-xs"
                  rows={2}
                />
                {pendingStatus === 'closed' && !canClose && (
                  <p className="text-xs text-destructive">
                    Defina a condição de retorno em todos os itens antes de fechar.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { q.refetch(); events.refetch(); }} disabled={q.isFetching}>
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

function ReturnConditionRow({
  allocation,
  onSave,
  disabled,
}: {
  allocation: any;
  onSave: (id: string, c: ReturnCondition, notes?: string) => void;
  disabled?: boolean;
}) {
  const [condition, setCondition] = useState<ReturnCondition | ''>(
    (allocation.return_condition as ReturnCondition) ?? '',
  );
  const [notes, setNotes] = useState(allocation.return_notes ?? '');
  const dirty =
    condition !== (allocation.return_condition ?? '') ||
    notes !== (allocation.return_notes ?? '');

  return (
    <TableRow>
      <TableCell className="text-sm">
        {allocation.serialized_item?.name || allocation.quantity_item?.name || '—'}
      </TableCell>
      <TableCell className="text-xs">{allocation.allocation_item_type}</TableCell>
      <TableCell className="text-right">{Number(allocation.allocated_quantity)}</TableCell>
      <TableCell>
        <Select value={condition} onValueChange={(v) => setCondition(v as ReturnCondition)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            {RETURN_CONDITIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {RETURN_CONDITION_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            className="text-xs min-w-[180px]"
          />
          <Button
            size="sm"
            disabled={!condition || !dirty || disabled}
            onClick={() => condition && onSave(allocation.id, condition as ReturnCondition, notes)}
          >
            Salvar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
