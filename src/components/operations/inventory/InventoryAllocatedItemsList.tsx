import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
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
  useCancelInventoryAllocation,
  useInventoryPreReservationAllocations,
} from '@/hooks/operations/useInventoryPreReservations';

interface Props {
  preReservationItemId: string | null;
}

function fmtDate(s: string) {
  try {
    return format(new Date(s), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function InventoryAllocatedItemsList({ preReservationItemId }: Props) {
  const { toast } = useToast();
  const q = useInventoryPreReservationAllocations(preReservationItemId);
  const cancel = useCancelInventoryAllocation();

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancelar esta alocação?')) return;
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Alocação cancelada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  if (q.isLoading) return <Skeleton className="h-20 w-full" />;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma alocação ainda.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item alocado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id} className={a.allocation_status !== 'active' ? 'opacity-50' : ''}>
              <TableCell>
                <div className="font-medium">{a.inventory_item_name ?? '—'}</div>
                {a.inventory_item_code && (
                  <div className="text-xs font-mono text-muted-foreground">
                    {a.inventory_item_code}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs">
                {a.allocation_item_type === 'serialized' ? 'Serializado' : 'Quantidade'}
              </TableCell>
              <TableCell className="text-right font-mono">{a.allocated_quantity}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    a.allocation_status === 'active'
                      ? 'default'
                      : a.allocation_status === 'cancelled'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {a.allocation_status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {fmtDate(a.created_at)}
              </TableCell>
              <TableCell className="text-right">
                {a.allocation_status === 'active' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancel(a.id)}
                    disabled={cancel.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
