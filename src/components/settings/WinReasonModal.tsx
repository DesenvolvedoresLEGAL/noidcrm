import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  createWinReason,
  updateWinReason,
  type WinReason,
} from '@/services/crm/win-reasons';
import { type Pipeline } from '@/services/crm/pipelines';

interface WinReasonModalProps {
  open: boolean;
  onClose: () => void;
  reason: WinReason | null;
  pipelines: Pipeline[];
}

export function WinReasonModal({
  open,
  onClose,
  reason,
  pipelines,
}: WinReasonModalProps) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [audience, setAudience] = useState<string>('both');
  const [allPipelines, setAllPipelines] = useState(true);
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (reason) {
        setName(reason.name);
        setIsActive(reason.is_active);
        setAudience((reason as any).audience || 'both');
        setAllPipelines(!reason.pipeline_ids || reason.pipeline_ids.length === 0);
        setSelectedPipelines(reason.pipeline_ids || []);
      } else {
        setName('');
        setIsActive(true);
        setAudience('both');
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
        audience,
      };

      if (reason) {
        await updateWinReason(reason.id, data);
        toast({
          title: 'Sucesso',
          description: 'Motivo de ganho atualizado',
        });
      } else {
        await createWinReason(data);
        toast({
          title: 'Sucesso',
          description: 'Motivo de ganho criado',
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving win reason:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar motivo de ganho',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePipeline = (pipelineId: string) => {
    setSelectedPipelines((prev) =>
      prev.includes(pipelineId)
        ? prev.filter((id) => id !== pipelineId)
        : [...prev, pipelineId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {reason ? 'Editar Motivo de Ganho' : 'Novo Motivo de Ganho'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do motivo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Melhor preço"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Visibilidade</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Cliente (link público)</SelectItem>
                <SelectItem value="seller">Vendedor (interno)</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define se este motivo aparece para o cliente no link público, para o vendedor no CRM, ou ambos.
            </p>
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

          <div className="space-y-2">
            <Label>Funis</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-pipelines"
                  checked={allPipelines}
                  onCheckedChange={(checked) => {
                    setAllPipelines(!!checked);
                    if (checked) setSelectedPipelines([]);
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
                <div className="ml-6 space-y-2">
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
