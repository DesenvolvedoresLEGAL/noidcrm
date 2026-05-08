import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventoryAvailabilitySnapshot } from '@/hooks/operations/useInventoryOccupancy';
import { RISK_LEVEL_BADGE, RISK_LEVEL_LABELS } from '@/lib/operations/inventoryOccupancy';
import { CalendarSearch } from 'lucide-react';

interface Props {
  defaultStart?: string | null;
  defaultEnd?: string | null;
  defaultCategoryId?: string | null;
  defaultFamilyId?: string | null;
  triggerLabel?: string;
}

export function InventoryAvailabilitySnapshotDialog({
  defaultStart,
  defaultEnd,
  defaultCategoryId = null,
  defaultFamilyId = null,
  triggerLabel = 'Ver capacidade no período',
}: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(defaultStart ?? today);
  const [end, setEnd] = useState(defaultEnd ?? today);
  const [qty, setQty] = useState<number>(1);

  const snapshot = useInventoryAvailabilitySnapshot(
    {
      start_date: start,
      end_date: end,
      category_id: defaultCategoryId,
      family_id: defaultFamilyId,
      requested_quantity: qty,
    },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarSearch className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snapshot de disponibilidade</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Início</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fim</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>

        {snapshot.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : snapshot.data ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Disponível</div>
                <div className="text-2xl font-semibold">{snapshot.data.available_quantity}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Pré reservadas" v={snapshot.data.pre_reserved_quantity} />
                <Stat label="Reservadas" v={snapshot.data.reserved_quantity} />
                <Stat label="Operação" v={snapshot.data.operational_quantity} />
                <Stat label="Manutenção" v={snapshot.data.maintenance_quantity} />
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={snapshot.data.can_fulfill ? 'default' : 'destructive'}>
                  {snapshot.data.can_fulfill ? 'Pode atender' : 'Disponibilidade parcial'}
                </Badge>
                <Badge variant={RISK_LEVEL_BADGE[snapshot.data.risk_level] ?? 'outline'}>
                  Risco {RISK_LEVEL_LABELS[snapshot.data.risk_level] ?? snapshot.data.risk_level}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{snapshot.data.message}</p>
            </CardContent>
          </Card>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between rounded border px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
