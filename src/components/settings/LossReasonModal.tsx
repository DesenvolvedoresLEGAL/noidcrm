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
import { Switch } from '@/components/ui/switch';
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
  const [audience, setAudience] = useState<string>('both');
  const [category, setCategory] = useState<string>('');
  const [reasonType, setReasonType] = useState<'lost' | 'disqualification'>('lost');
  const [accountability, setAccountability] = useState<string>('unknown');
  const [sendToRemarketing, setSendToRemarketing] = useState(false);
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
        setCategory((reason as any).category || '');
        setReasonType(((reason as any).reason_type as any) || 'lost');
        setAccountability((reason as any).loss_accountability || 'unknown');
        setSendToRemarketing(!!(reason as any).send_to_remarketing_default);
        setAllPipelines(!reason.pipeline_ids || reason.pipeline_ids.length === 0);
        setSelectedPipelines(reason.pipeline_ids || []);
      } else {
        setName('');
        setIsActive(true);
        setAudience('both');
        setCategory('');
        setReasonType('lost');
        setAccountability('unknown');
        setSendToRemarketing(false);
        setAllPipelines(true);
        setSelectedPipelines([]);
      }
    }
  }, [open, reason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Erro', description: 'Nome do motivo é obrigatório', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        is_active: isActive,
        pipeline_ids: allPipelines ? null : selectedPipelines,
        audience,
        category: category || null,
        reason_type: reasonType,
        loss_accountability: accountability,
        send_to_remarketing_default: sendToRemarketing,
      };

      if (reason) {
        await updateLossReason(reason.id, data);
        toast({ title: 'Sucesso', description: 'Motivo atualizado' });
      } else {
        await createLossReason(data);
        toast({ title: 'Sucesso', description: 'Motivo criado' });
      }
      onClose();
    } catch (error) {
      console.error('Error saving loss reason:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar motivo', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const togglePipeline = (pipelineId: string) => {
    setSelectedPipelines((prev) =>
      prev.includes(pipelineId) ? prev.filter((id) => id !== pipelineId) : [...prev, pipelineId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reason ? 'Editar Motivo' : 'Novo Motivo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Motivo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sem evento definido"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={reasonType} onValueChange={(v) => setReasonType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lost">Motivo de Perda</SelectItem>
                  <SelectItem value="disqualification">Motivo de Desqualificação</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {reasonType === 'disqualification'
                  ? 'Usado no botão "Perdeu" do funil PRÉ VENDAS.'
                  : 'Usado em fechamentos perdidos em VENDAS.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Accountability</Label>
              <Select value={accountability} onValueChange={setAccountability}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Comercial</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="market">Mercado</SelectItem>
                  <SelectItem value="operations">Operações</SelectItem>
                  <SelectItem value="unknown">Indefinido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria (Macro Motivo)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Preço / Valor</SelectItem>
                <SelectItem value="competition">Concorrência</SelectItem>
                <SelectItem value="timing">Timing / Prioridade</SelectItem>
                <SelectItem value="operational">Operacional Cliente</SelectItem>
                <SelectItem value="internal">Erro Interno</SelectItem>
                <SelectItem value="no_fit">Sem Fit</SelectItem>
                <SelectItem value="sales_process">Processo Comercial</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Visibilidade</Label>
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
            <p className="text-[11px] text-muted-foreground">
              O modal "Desqualificar lead" só lista motivos com visibilidade Vendedor ou Ambos.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="rmkt">Enviar para Remarketing por padrão</Label>
              <p className="text-[11px] text-muted-foreground">
                Quando este motivo for selecionado, marcar a opção de criar oportunidade no
                funil Remarketing.
              </p>
            </div>
            <Switch id="rmkt" checked={sendToRemarketing} onCheckedChange={setSendToRemarketing} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={isActive ? 'active' : 'inactive'}
              onValueChange={(v) => setIsActive(v === 'active')}
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
                  if (checked) setSelectedPipelines([]);
                }}
              />
              <label htmlFor="all-pipelines" className="text-sm font-medium">
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
                    <label htmlFor={`pipeline-${pipeline.id}`} className="text-sm">
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
