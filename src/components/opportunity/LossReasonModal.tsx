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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getLossReasonsByPipeline, type LossReason } from '@/services/crm/loss-reasons';
import { DollarSign, Clock, Boxes, Users } from 'lucide-react';

export interface LossDetails {
  lossReasonId: string;
  comment: string;
  competitor?: string;
  priceFactor: boolean;
  timingFactor: boolean;
  featureFactor: boolean;
  relationshipFactor: boolean;
}

interface LossReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (details: LossDetails) => void;
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
  const [competitor, setCompetitor] = useState('');
  const [priceFactor, setPriceFactor] = useState(false);
  const [timingFactor, setTimingFactor] = useState(false);
  const [featureFactor, setFeatureFactor] = useState(false);
  const [relationshipFactor, setRelationshipFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadLossReasons();
      resetForm();
    }
  }, [open, pipelineId]);

  const resetForm = () => {
    setSelectedReasonId('');
    setComment('');
    setCompetitor('');
    setPriceFactor(false);
    setTimingFactor(false);
    setFeatureFactor(false);
    setRelationshipFactor(false);
  };

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
    onConfirm({
      lossReasonId: selectedReasonId,
      comment: comment.trim(),
      competitor: competitor.trim() || undefined,
      priceFactor,
      timingFactor,
      featureFactor,
      relationshipFactor
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Marcar como Perdida</DialogTitle>
          <DialogDescription>
            {opportunityTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {/* Motivo de Perda */}
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

          {/* Concorrente */}
          <div className="space-y-2">
            <Label htmlFor="competitor">Perdemos para qual concorrente?</Label>
            <Input
              id="competitor"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="Nome do concorrente (se aplicável)"
            />
          </div>

          {/* Fatores de Decisão */}
          <div className="space-y-3">
            <Label>Fatores que influenciaram a decisão</Label>
            <div className="grid grid-cols-2 gap-3">
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  priceFactor ? 'border-red-500 bg-red-500/10' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setPriceFactor(!priceFactor)}
              >
                <Checkbox 
                  checked={priceFactor} 
                  onCheckedChange={(checked) => setPriceFactor(!!checked)}
                />
                <DollarSign className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Preço</span>
              </div>
              
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  timingFactor ? 'border-yellow-500 bg-yellow-500/10' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setTimingFactor(!timingFactor)}
              >
                <Checkbox 
                  checked={timingFactor} 
                  onCheckedChange={(checked) => setTimingFactor(!!checked)}
                />
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Timing</span>
              </div>
              
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  featureFactor ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setFeatureFactor(!featureFactor)}
              >
                <Checkbox 
                  checked={featureFactor} 
                  onCheckedChange={(checked) => setFeatureFactor(!!checked)}
                />
                <Boxes className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Features</span>
              </div>
              
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  relationshipFactor ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setRelationshipFactor(!relationshipFactor)}
              >
                <Checkbox 
                  checked={relationshipFactor} 
                  onCheckedChange={(checked) => setRelationshipFactor(!!checked)}
                />
                <Users className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Relacionamento</span>
              </div>
            </div>
          </div>

          {/* Comentários */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comentários (opcional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicione detalhes sobre o motivo da perda, lições aprendidas..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
