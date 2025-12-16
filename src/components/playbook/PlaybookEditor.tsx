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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { Playbook } from '@/hooks/usePlaybookSystem';

interface PlaybookEditorProps {
  playbook?: Playbook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (playbook: Partial<Playbook>) => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  type: string;
  duration_hours: number;
}

export function PlaybookEditor({ playbook, open, onOpenChange, onSave }: PlaybookEditorProps) {
  const [name, setName] = useState(playbook?.name || '');
  const [description, setDescription] = useState(playbook?.description || '');
  const [category, setCategory] = useState(playbook?.category || '');
  const [complexity, setComplexity] = useState(playbook?.complexity || 'moderate');
  const [estimatedHours, setEstimatedHours] = useState(playbook?.estimated_hours || 2);
  const [roiThreshold, setRoiThreshold] = useState(playbook?.roi_threshold || 0.5);
  const [minSampleSize, setMinSampleSize] = useState(playbook?.min_sample_size || 10);
  const [targetPersona, setTargetPersona] = useState(playbook?.target_persona || '');
  const [targetStage, setTargetStage] = useState(playbook?.target_stage || '');
  const [isActive, setIsActive] = useState(playbook?.is_active !== false);
  const [steps, setSteps] = useState<Step[]>(
    (playbook?.steps as Step[]) || [
      { id: '1', title: '', description: '', type: 'action', duration_hours: 0.5 }
    ]
  );

  const handleAddStep = () => {
    setSteps([
      ...steps,
      { 
        id: String(Date.now()), 
        title: '', 
        description: '', 
        type: 'action', 
        duration_hours: 0.5 
      }
    ]);
  };

  const handleRemoveStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== id));
    }
  };

  const handleStepChange = (id: string, field: keyof Step, value: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    onSave({
      id: playbook?.id,
      name,
      description,
      category: category || null,
      complexity,
      estimated_hours: estimatedHours,
      roi_threshold: roiThreshold,
      min_sample_size: minSampleSize,
      target_persona: targetPersona || null,
      target_stage: targetStage || null,
      is_active: isActive,
      steps,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{playbook ? 'Editar Playbook' : 'Novo Playbook'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes e passos do playbook de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do playbook"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo e quando usar este playbook"
                rows={2}
              />
            </div>
          </div>

          {/* Category & Complexity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecção</SelectItem>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="negotiation">Negociação</SelectItem>
                  <SelectItem value="closing">Fechamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="complexity">Complexidade</Label>
              <Select value={complexity} onValueChange={setComplexity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simples</SelectItem>
                  <SelectItem value="moderate">Moderado</SelectItem>
                  <SelectItem value="complex">Complexo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="targetPersona">Persona Alvo</Label>
              <Input
                id="targetPersona"
                value={targetPersona}
                onChange={(e) => setTargetPersona(e.target.value)}
                placeholder="Ex: CEO, Diretor de TI"
              />
            </div>
            <div>
              <Label htmlFor="targetStage">Estágio Alvo</Label>
              <Input
                id="targetStage"
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value)}
                placeholder="Ex: Qualificação, Proposta"
              />
            </div>
          </div>

          {/* ROI Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="estimatedHours">Horas Estimadas</Label>
              <Input
                id="estimatedHours"
                type="number"
                step="0.5"
                min="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 2)}
              />
            </div>
            <div>
              <Label htmlFor="roiThreshold">ROI Mínimo (R$/h)</Label>
              <Input
                id="roiThreshold"
                type="number"
                step="0.1"
                min="0"
                value={roiThreshold}
                onChange={(e) => setRoiThreshold(parseFloat(e.target.value) || 0.5)}
              />
            </div>
            <div>
              <Label htmlFor="minSampleSize">Amostra Mínima</Label>
              <Input
                id="minSampleSize"
                type="number"
                min="5"
                value={minSampleSize}
                onChange={(e) => setMinSampleSize(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Passos do Playbook</Label>
              <Button variant="outline" size="sm" onClick={handleAddStep}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Passo
              </Button>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div 
                  key={step.id} 
                  className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2 pt-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={step.title}
                      onChange={(e) => handleStepChange(step.id, 'title', e.target.value)}
                      placeholder="Título do passo"
                    />
                    <Textarea
                      value={step.description}
                      onChange={(e) => handleStepChange(step.id, 'description', e.target.value)}
                      placeholder="Descrição detalhada"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Select 
                        value={step.type} 
                        onValueChange={(v) => handleStepChange(step.id, 'type', v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="action">Ação</SelectItem>
                          <SelectItem value="call">Ligação</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="meeting">Reunião</SelectItem>
                          <SelectItem value="wait">Aguardar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={step.duration_hours}
                        onChange={(e) => handleStepChange(step.id, 'duration_hours', parseFloat(e.target.value) || 0)}
                        className="w-24"
                        placeholder="Horas"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveStep(step.id)}
                    disabled={steps.length === 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Playbook Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Playbooks inativos não aparecem nas sugestões
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {playbook ? 'Salvar Alterações' : 'Criar Playbook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
