import { useEffect, useState } from 'react';
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
import { useGeneratePreReservationFromProposal } from '@/hooks/operations/useInventoryPreReservations';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  proposalId: string;
  defaultDate?: string | null;
}

function toDateInput(v?: string | null) {
  if (!v) return '';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function GeneratePreReservationDialog({
  open,
  onOpenChange,
  proposalId,
  defaultDate,
}: Props) {
  const { toast } = useToast();
  const gen = useGeneratePreReservationFromProposal();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      const d = toDateInput(defaultDate);
      setStart(d);
      setEnd(d);
      setNotes('');
    }
  }, [open, defaultDate]);

  const handleSubmit = async () => {
    if (!start || !end) {
      toast({
        title: 'Datas obrigatórias',
        description: 'Informe início e fim do evento.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await gen.mutateAsync({
        proposal_id: proposalId,
        event_start_date: start,
        event_end_date: end,
        notes: notes.trim() || null,
      });
      toast({
        title: 'Pré reserva gerada',
        description: 'Disponibilidade recalculada automaticamente.',
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Erro ao gerar pré reserva',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar pré reserva de inventário</DialogTitle>
          <DialogDescription>
            Período operacional será calculado como evento −1 dia (preparação) e +1 dia
            (retorno/conferência).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início do evento</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Fim do evento</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
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
          <Button onClick={handleSubmit} disabled={gen.isPending}>
            Gerar pré reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
