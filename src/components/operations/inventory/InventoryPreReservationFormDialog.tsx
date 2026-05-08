import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { computeOperationalPeriod } from '@/lib/operations/inventoryPreReservations';
import { useCreateInventoryPreReservation } from '@/hooks/operations/useInventoryPreReservations';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function InventoryPreReservationFormDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const create = useCreateInventoryPreReservation();
  const [title, setTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !eventStart || !eventEnd) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe título e período do evento.',
        variant: 'destructive',
      });
      return;
    }
    const period = computeOperationalPeriod(eventStart, eventEnd);
    try {
      await create.mutateAsync({
        title: title.trim(),
        source: 'manual',
        operational_start_date: period.operational_start_date,
        operational_end_date: period.operational_end_date,
        event_start_date: eventStart,
        event_end_date: eventEnd,
        notes: notes.trim() || null,
        items: [],
      });
      toast({
        title: 'Pré reserva criada',
        description:
          'Adicione itens diretamente no banco ou crie via proposta. Edição de itens via UI será expandida nas próximas sprints.',
      });
      setTitle('');
      setEventStart('');
      setEventEnd('');
      setNotes('');
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao criar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pré reserva</DialogTitle>
          <DialogDescription>
            Cria uma pré reserva manual. O período operacional é calculado como evento −1/+1 dia.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início do evento</Label>
              <Input type="date" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
            </div>
            <div>
              <Label>Fim do evento</Label>
              <Input type="date" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            Criar pré reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
