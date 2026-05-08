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
import { useInventoryItemMutations } from '@/hooks/operations/useInventoryItems';
import type { InventoryItemWithRefs } from '@/services/operations/inventoryItems';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItemWithRefs | null;
}

export function InventoryItemStatusDialog({ open, onOpenChange, item }: Props) {
  const { updateStatus } = useInventoryItemMutations();
  const [status, setStatus] = useState<InventoryItemStatus>('available');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && item) {
      setStatus(item.status as InventoryItemStatus);
      setReason('');
    }
  }, [open, item]);

  const apply = async () => {
    if (!item) return;
    if (reason.length > 300) {
      toast.error('Motivo deve ter no máximo 300 caracteres.');
      return;
    }
    try {
      await updateStatus.mutateAsync({ id: item.id, status });
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

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                rows={3}
                placeholder="Ex: Enviado para manutenção preventiva."
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
