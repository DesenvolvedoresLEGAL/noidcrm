import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number, notes: string) => void;
  submitting: boolean;
}

export default function SimulationFeedbackModal({ open, onOpenChange, onSubmit, submitting }: Props) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (rating < 1) return;
    onSubmit(rating, notes);
    setRating(0);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar Simulação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Qualidade da Simulação</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => setRating(v)} className="p-1 hover:scale-110 transition-transform">
                  <Star className={`h-6 w-6 ${v <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm">Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que poderia ser melhor?" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={rating < 1 || submitting}>
            {submitting ? 'Enviando...' : 'Enviar Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
