import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ITEM_STATUS_LABEL,
  ITEM_STATUS_OPTIONS,
  DESTRUCTIVE_STATUSES,
  STATUS_CONFIRM_TEXT,
  type InventoryItemStatus,
} from '@/lib/operations/inventoryLabels';
import { useInventoryQuantityItemMutations } from '@/hooks/operations/useInventoryItems';
import type { InventoryItemWithRefs } from '@/services/operations/inventoryItems';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItemWithRefs | null;
}

export function InventoryQuantityItemStatusDialog({ open, onOpenChange, item }: Props) {
  const { updateStatus } = useInventoryQuantityItemMutations();
  const [status, setStatus] = useState<InventoryItemStatus>('available');
  const [reason, setReason] = useState('');
  const [qtyAvailable, setQtyAvailable] = useState<string>('0');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && item) {
      setStatus(item.status as InventoryItemStatus);
      setReason('');
      setQtyAvailable(String(item.quantity_available ?? 0));
    }
  }, [open, item]);

  const total = Number(item?.quantity_total ?? 0);
  const currentStatus = item?.status as InventoryItemStatus | undefined;
  const needsQty = status === 'available' && currentStatus !== 'available';

  const apply = async () => {
    if (!item) return;
    if (reason.length > 300) {
      toast.error('Motivo deve ter no máximo 300 caracteres.');
      return;
    }
    let qty = 0;
    if (status === 'available') {
      qty = Number(qtyAvailable);
      if (!Number.isFinite(qty) || qty < 0) {
        toast.error('Informe uma quantidade disponível válida.');
        return;
      }
      if (qty > total) {
        toast.error('A quantidade disponível não pode ser maior que a quantidade total.');
        return;
      }
    }
    try {
      await updateStatus.mutateAsync({ id: item.id, status, quantityAvailable: qty, total });
      toast.success('Status alterado com sucesso.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setConfirmOpen(false);
    }
  };

  const handleSubmit = () => {
    if (!item) return;
    if (DESTRUCTIVE_STATUSES.includes(status) && status !== item.status) {
      setConfirmOpen(true);
      return;
    }
    apply();
  };

  if (!item) return null;
  const currentLabel = ITEM_STATUS_LABEL[item.status as InventoryItemStatus] ?? item.status;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar status</DialogTitle>
            <DialogDescription>
              Item: <span className="font-medium">{item.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm">
              Status atual: <span className="font-medium">{currentLabel}</span>
            </div>

            <div className="space-y-2">
              <Label>Novo status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InventoryItemStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === 'available' && (
              <div className="space-y-2">
                <Label htmlFor="qty">Quantidade disponível</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  min="0"
                  max={total}
                  value={qtyAvailable}
                  onChange={(e) => setQtyAvailable(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: {total} (quantidade total).
                  {needsQty && ' Defina a nova quantidade disponível.'}
                </p>
              </div>
            )}

            {status !== 'available' && (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                A quantidade disponível será ajustada para 0.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                rows={3}
                placeholder="Ex: Material bloqueado para conferência."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground">{reason.length}/300</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? 'Salvando...' : 'Alterar status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de status</AlertDialogTitle>
            <AlertDialogDescription>
              {STATUS_CONFIRM_TEXT[status] ?? 'Deseja confirmar a alteração?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
