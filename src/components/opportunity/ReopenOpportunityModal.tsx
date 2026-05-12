import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Stage {
  id: string;
  name: string;
  order_index: number;
}

interface ReopenOpportunityModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, targetStageId: string) => void;
  opportunityTitle: string;
  pipelineId: string;
  isLoading?: boolean;
}

export function ReopenOpportunityModal({
  open,
  onClose,
  onConfirm,
  opportunityTitle,
  pipelineId,
  isLoading = false,
}: ReopenOpportunityModalProps) {
  const [reason, setReason] = useState('');
  const [targetStageId, setTargetStageId] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  useEffect(() => {
    if (open && pipelineId) {
      loadStages();
    }
  }, [open, pipelineId]);

  const loadStages = async () => {
    setLoadingStages(true);
    try {
      const { data, error } = await supabase
        .from('stages')
        .select('id, name, order_index')
        .eq('pipeline_id', pipelineId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      const stagesList = data || [];
      setStages(stagesList);

      // Default to second-to-last stage (before "Ganhamos")
      if (stagesList.length >= 2) {
        setTargetStageId(stagesList[stagesList.length - 2].id);
      } else if (stagesList.length > 0) {
        setTargetStageId(stagesList[0].id);
      }
    } catch (error) {
      console.error('Error loading stages:', error);
    } finally {
      setLoadingStages(false);
    }
  };

  const handleConfirm = () => {
    if (!reason.trim()) return;
    if (!targetStageId) return;
    onConfirm(reason.trim(), targetStageId);
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const isValid = reason.trim().length > 0 && targetStageId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-500" />
            Reabrir Oportunidade
          </DialogTitle>
          <DialogDescription>
            Reabrir "<strong>{opportunityTitle}</strong>" para permitir nova negociação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <p className="font-medium">Esta ação irá:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Reverter o status para "Aberta"</li>
                <li>Marcar propostas aceitas como recusadas por cancelamento do cliente</li>
                <li>Mover para a etapa selecionada</li>
              </ul>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo da reabertura <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Ex: Cliente desistiu após aprovação inicial..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Target Stage */}
          <div className="space-y-2">
            <Label htmlFor="stage">Etapa de destino</Label>
            <Select
              value={targetStageId}
              onValueChange={setTargetStageId}
              disabled={loadingStages}
            >
              <SelectTrigger id="stage">
                <SelectValue placeholder={loadingStages ? 'Carregando...' : 'Selecione a etapa'} />
              </SelectTrigger>
              <SelectContent>
                {stages
                  .filter((s) => s.name.toLowerCase() !== 'ganhamos' && s.name.toLowerCase() !== 'perdemos')
                  .map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A oportunidade será movida para esta etapa após reaberta.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Reabrindo...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reabrir Oportunidade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
