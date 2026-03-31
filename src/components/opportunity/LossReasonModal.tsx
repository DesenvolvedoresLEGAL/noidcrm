import { useEffect, useState, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { getLossReasonsByPipeline, type LossReason } from '@/services/crm/loss-reasons';

const MACRO_CATEGORIES = [
  { value: 'price', label: 'Preço / Valor' },
  { value: 'competition', label: 'Concorrência' },
  { value: 'timing', label: 'Timing / Prioridade' },
  { value: 'operational', label: 'Operacional Cliente' },
  { value: 'internal', label: 'Erro Interno' },
  { value: 'no_fit', label: 'Sem Fit' },
  { value: 'sales_process', label: 'Processo Comercial' },
  { value: 'other', label: 'Outro' },
] as const;

export interface LossDetails {
  lossReasonId: string;
  macroCategory: string;
  comment: string;
  competitor?: string;
  lossAccountability: string;
  isRecoverable: string;
  // Derived factor booleans for backward compatibility
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
  const [allReasons, setAllReasons] = useState<LossReason[]>([]);
  const [macroCategory, setMacroCategory] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [comment, setComment] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [lossAccountability, setLossAccountability] = useState('');
  const [isRecoverable, setIsRecoverable] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadLossReasons();
      resetForm();
    }
  }, [open, pipelineId]);

  const resetForm = () => {
    setMacroCategory('');
    setSelectedReasonId('');
    setComment('');
    setCompetitor('');
    setLossAccountability('');
    setIsRecoverable('');
  };

  const loadLossReasons = async () => {
    try {
      const reasons = await getLossReasonsByPipeline(pipelineId);
      setAllReasons(reasons);
    } catch (error) {
      console.error('Error loading loss reasons:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar motivos de perda',
        variant: 'destructive',
      });
    }
  };

  // Filter reasons by selected macro category
  const filteredReasons = useMemo(() => {
    if (!macroCategory) return [];
    return allReasons.filter(r => (r as any).category === macroCategory);
  }, [allReasons, macroCategory]);

  // Reset specific reason when macro changes
  useEffect(() => {
    setSelectedReasonId('');
  }, [macroCategory]);

  const commentLength = comment.trim().length;
  const isCommentValid = commentLength >= 100;

  const canSubmit =
    macroCategory &&
    selectedReasonId &&
    lossAccountability &&
    isRecoverable &&
    isCommentValid;

  const handleConfirm = () => {
    if (!canSubmit) {
      toast({
        title: 'Atenção',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    onConfirm({
      lossReasonId: selectedReasonId,
      macroCategory,
      comment: comment.trim(),
      competitor: macroCategory === 'competition' ? competitor.trim() || undefined : undefined,
      lossAccountability,
      isRecoverable,
      // Derive factor booleans from macro category for backward compatibility
      priceFactor: macroCategory === 'price',
      timingFactor: macroCategory === 'timing',
      featureFactor: macroCategory === 'no_fit' || macroCategory === 'sales_process',
      relationshipFactor: macroCategory === 'internal',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marcar como Perdida</DialogTitle>
          <DialogDescription>{opportunityTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {/* 1. Macro Motivo */}
          <div className="space-y-2">
            <Label>Macro Motivo *</Label>
            <Select value={macroCategory} onValueChange={setMacroCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {MACRO_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Motivo Específico */}
          <div className="space-y-2">
            <Label>Motivo Específico *</Label>
            <Select
              value={selectedReasonId}
              onValueChange={setSelectedReasonId}
              disabled={!macroCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder={macroCategory ? 'Selecione o motivo' : 'Selecione o macro motivo primeiro'} />
              </SelectTrigger>
              <SelectContent>
                {filteredReasons.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum motivo nesta categoria
                  </SelectItem>
                ) : (
                  filteredReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Concorrente (condicional) */}
          {macroCategory === 'competition' && (
            <div className="space-y-2">
              <Label>Concorrente</Label>
              <Input
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
                placeholder="Nome do concorrente"
              />
            </div>
          )}

          {/* 4. Responsável pela perda */}
          <div className="space-y-2">
            <Label>Responsável pela perda *</Label>
            <RadioGroup value={lossAccountability} onValueChange={setLossAccountability} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="client" id="acc-client" />
                <Label htmlFor="acc-client" className="cursor-pointer font-normal">Cliente</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="competition" id="acc-competition" />
                <Label htmlFor="acc-competition" className="cursor-pointer font-normal">Concorrência</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="us" id="acc-us" />
                <Label htmlFor="acc-us" className="cursor-pointer font-normal">Nós</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 5. Recuperável? */}
          <div className="space-y-2">
            <Label>Recuperável? *</Label>
            <RadioGroup value={isRecoverable} onValueChange={setIsRecoverable} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="rec-yes" />
                <Label htmlFor="rec-yes" className="cursor-pointer font-normal">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="rec-no" />
                <Label htmlFor="rec-no" className="cursor-pointer font-normal">Não</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="maybe" id="rec-maybe" />
                <Label htmlFor="rec-maybe" className="cursor-pointer font-normal">Talvez</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 6. Diagnóstico */}
          <div className="space-y-2">
            <Label>Diagnóstico da perda * <span className="text-xs text-muted-foreground">(mínimo 100 caracteres)</span></Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Descreva o contexto da perda, lições aprendidas e o que aconteceu..."
              rows={4}
            />
            <p className={`text-xs ${isCommentValid ? 'text-muted-foreground' : 'text-destructive'}`}>
              {commentLength}/100 caracteres
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !canSubmit}
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
