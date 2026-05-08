import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, Loader2, PackageSearch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  useCreateInventoryAllocation,
  useInventoryAllocationCandidates,
  useInventoryPreReservation,
  useInventoryPreReservationAllocations,
} from '@/hooks/operations/useInventoryPreReservations';
import type { AllocationCandidate } from '@/services/operations/inventoryAllocations';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preReservationId: string | null;
  preReservationItemId: string | null;
}

interface SelectionState {
  [candidateKey: string]: number; // qty to allocate
}

export function InventoryAllocationDialog({
  open,
  onOpenChange,
  preReservationId,
  preReservationItemId,
}: Props) {
  const { toast } = useToast();
  const reservation = useInventoryPreReservation(preReservationId);
  const candidatesQ = useInventoryAllocationCandidates(open ? preReservationItemId : null);
  const allocationsQ = useInventoryPreReservationAllocations(open ? preReservationItemId : null);
  const create = useCreateInventoryAllocation();

  const [sel, setSel] = useState<SelectionState>({});
  const [submitting, setSubmitting] = useState(false);

  const demand = useMemo(
    () => reservation.data?.items.find((i) => i.id === preReservationItemId) ?? null,
    [reservation.data, preReservationItemId],
  );
  const requested = Number(demand?.requested_quantity ?? 0);
  const alreadyAllocated = (allocationsQ.data ?? [])
    .filter((a) => a.allocation_status === 'active')
    .reduce((s, a) => s + Number(a.allocated_quantity), 0);
  const remaining = Math.max(requested - alreadyAllocated, 0);

  const totalSelected = Object.values(sel).reduce((s, v) => s + (Number(v) || 0), 0);

  const handleClose = (o: boolean) => {
    if (!o) setSel({});
    onOpenChange(o);
  };

  const handleConfirm = async () => {
    if (!preReservationId || !preReservationItemId) return;
    if (totalSelected <= 0) {
      toast({ title: 'Selecione ao menos um item.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const candidates = candidatesQ.data ?? [];
      for (const [key, qty] of Object.entries(sel)) {
        const q = Number(qty);
        if (!q || q <= 0) continue;
        const [type, id] = key.split('::') as ['serialized' | 'quantity', string];
        const cand = candidates.find((c) => c.candidate_type === type && c.candidate_id === id);
        if (!cand) continue;
        if (q > Number(cand.available_quantity)) {
          throw new Error(`Quantidade indisponível para ${cand.candidate_name}`);
        }
        if (type === 'serialized' && q !== 1) {
          throw new Error('Item serializado deve ter quantidade 1.');
        }
        await create.mutateAsync({
          pre_reservation_id: preReservationId,
          pre_reservation_item_id: preReservationItemId,
          allocation_item_type: type,
          serialized_item_id: type === 'serialized' ? id : null,
          quantity_item_id: type === 'quantity' ? id : null,
          allocated_quantity: q,
        });
      }
      toast({ title: 'Alocação realizada' });
      setSel({});
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const setQty = (cand: AllocationCandidate, qty: number) => {
    const key = `${cand.candidate_type}::${cand.candidate_id}`;
    setSel((prev) => {
      const next = { ...prev };
      if (!qty || qty <= 0) delete next[key];
      else next[key] = qty;
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" /> Alocar itens
          </DialogTitle>
          <DialogDescription>
            {demand?.demand_label || demand?.notes || 'Selecione os itens disponíveis no período.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Solicitado</p>
              <p className="text-lg font-semibold">{requested}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Já alocado</p>
              <p className="text-lg font-semibold">{alreadyAllocated}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Restante</p>
              <p className="text-lg font-semibold">{remaining}</p>
            </div>
          </div>

          {totalSelected > 0 && totalSelected + alreadyAllocated < requested && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Alocação parcial</AlertTitle>
              <AlertDescription>
                A demanda permanecerá parcialmente alocada após confirmar.
              </AlertDescription>
            </Alert>
          )}

          {candidatesQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (candidatesQ.data ?? []).length === 0 ? (
            <Alert variant="destructive">
              <Boxes className="h-4 w-4" />
              <AlertTitle>Sem candidatos disponíveis</AlertTitle>
              <AlertDescription>
                Não há itens compatíveis com a categoria/família dessa demanda no período.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria / Família</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Alocar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(candidatesQ.data ?? []).map((c) => {
                    const key = `${c.candidate_type}::${c.candidate_id}`;
                    const current = sel[key] ?? 0;
                    const disabled = c.status === 'unavailable' || c.available_quantity <= 0;
                    return (
                      <TableRow key={key} className={disabled ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="font-medium">{c.candidate_name}</div>
                          {c.candidate_code && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {c.candidate_code}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.candidate_type === 'serialized' ? 'Serializado' : 'Quantidade'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.category_name ?? '—'}
                          {c.family_name ? ` / ${c.family_name}` : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {c.available_quantity}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === 'available'
                                ? 'default'
                                : c.status === 'partial'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.candidate_type === 'serialized' ? (
                            <Checkbox
                              checked={current === 1}
                              disabled={disabled}
                              onCheckedChange={(v) => setQty(c, v ? 1 : 0)}
                            />
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              max={c.available_quantity}
                              step="1"
                              className="w-24 ml-auto"
                              disabled={disabled}
                              value={current || ''}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                const clamped = Math.min(
                                  Math.max(0, isNaN(n) ? 0 : n),
                                  Number(c.available_quantity),
                                );
                                setQty(c, clamped);
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalSelected > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Resumo</AlertTitle>
              <AlertDescription>
                {totalSelected} unidade(s) selecionada(s) para alocação.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || totalSelected === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar alocação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
