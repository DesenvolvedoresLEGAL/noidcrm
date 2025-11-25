import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createLossReason,
  updateLossReason,
  type LossReason,
} from '@/services/crm/loss-reasons';
import type { Pipeline } from '@/services/crm/pipelines';

interface LossReasonModalProps {
  open: boolean;
  onClose: () => void;
  reason: LossReason | null;
  pipelines: Pipeline[];
}

export function LossReasonModal({
  open,
  onClose,
  reason,
  pipelines,
}: LossReasonModalProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [allPipelines, setAllPipelines] = useState(true);
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (reason) {
        setName(reason.name);
        setIsActive(reason.is_active);
        setAllPipelines(!reason.pipeline_ids || reason.pipeline_ids.length === 0);
        setSelectedPipelines(reason.pipeline_ids || []);
      } else {
        setName('');
        setIsActive(true);
        setAllPipelines(true);
        setSelectedPipelines([]);
      }
    }
  }, [open, reason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do motivo é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const data = {
        name: name.trim(),
        is_active: isActive,
        pipeline_ids: allPipelines ? null : selectedPipelines,
      };

      if (reason) {
        await updateLossReason(reason.id, data);
        toast({
          title: 'Sucesso',
          description: 'Motivo de perda atualizado',
        });
      } else {
        await createLossReason(data);
        toast({
          title: 'Sucesso',
          description: 'Motivo de perda criado',
        });
      }
      onClose();
    } catch (error) {
      console.error('Error saving loss reason:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar motivo de perda',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePipeline = (pipelineId: string) => {
    setSelectedPipelines(prev =>
      prev.includes(pipelineId)
        ? prev.filter(id => id !== pipelineId)
        : [...prev, pipelineId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {reason ? 'Editar Motivo de Perda' : 'Novo Motivo de Perda'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Motivo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Preço percebido como alto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={isActive ? 'active' : 'inactive'}
              onValueChange={(value) => setIsActive(value === 'active')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Funis</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-pipelines"
                checked={allPipelines}
                onCheckedChange={(checked) => {
                  setAllPipelines(checked as boolean);
                  if (checked) {
                    setSelectedPipelines([]);
                  }
                }}
              />
              <label
                htmlFor="all-pipelines"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Todos os funis
              </label>
            </div>

            {!allPipelines && (
              <div className="space-y-2 border rounded-md p-3 max-h-[200px] overflow-y-auto">
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`pipeline-${pipeline.id}`}
                      checked={selectedPipelines.includes(pipeline.id)}
                      onCheckedChange={() => togglePipeline(pipeline.id)}
                    />
                    <label
                      htmlFor={`pipeline-${pipeline.id}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {pipeline.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
