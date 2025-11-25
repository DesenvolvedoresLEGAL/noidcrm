import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { getLossReasonsByPipeline, type LossReason } from '@/services/crm/loss-reasons';

interface LossReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lossReasonId: string, comment: string) => void;
  opportunityTitle: string;
  pipelineId: string | null;
}

export function LossReasonModal({
  open,
  onClose,
  onConfirm,
  opportunityTitle,
  pipelineId,
}: LossReasonModalProps) {
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadLossReasons();
      setSelectedReasonId('');
      setComment('');
    }
  }, [open, pipelineId]);

  const loadLossReasons = async () => {
    try {
      const reasons = await getLossReasonsByPipeline(pipelineId);
      setLossReasons(reasons);
    } catch (error) {
      console.error('Error loading loss reasons:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar motivos de perda',
        variant: 'destructive',
      });
    }
  };

  const handleConfirm = () => {
    if (!selectedReasonId) {
      toast({
        title: 'Atenção',
        description: 'Selecione um motivo de perda',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    onConfirm(selectedReasonId, comment.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Marcar como Perdida</DialogTitle>
          <DialogDescription>
            {opportunityTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Motivo de Perda *</Label>
            <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum motivo disponível
                  </SelectItem>
                ) : (
                  lossReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comentários (opcional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicione detalhes sobre o motivo da perda..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !selectedReasonId}
              variant="destructive"
            >
              {loading ? 'Confirmando...' : 'Confirmar Perda'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
