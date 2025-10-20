import { useState, useEffect } from 'react';
import { Stage } from '@/services/crm/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';

interface EditStageModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Stage>) => void;
  onDelete?: () => void;
  stage?: Stage;
  pipelineName: string;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

export function EditStageModal({ open, onClose, onSave, onDelete, stage, pipelineName }: EditStageModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [probability, setProbability] = useState('0');
  const [stagnationAlert, setStagnationAlert] = useState('7');
  const [allowCreate, setAllowCreate] = useState(true);
  const [allowWin, setAllowWin] = useState(false);
  const [allowLose, setAllowLose] = useState(true);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setDescription(stage.description || '');
      setColor(stage.color || '#3b82f6');
      setProbability(String(stage.probability ?? 0));
      setStagnationAlert(String(stage.stagnation_alert_days ?? 7));
      setAllowCreate(stage.allow_create_opportunity ?? true);
      setAllowWin(stage.allow_win_opportunity ?? false);
      setAllowLose(stage.allow_lose_opportunity ?? true);
    } else {
      setName('');
      setDescription('');
      setColor('#3b82f6');
      setProbability('0');
      setStagnationAlert('7');
      setAllowCreate(true);
      setAllowWin(false);
      setAllowLose(true);
    }
  }, [stage, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      probability: Number(probability),
      stagnation_alert_days: Number(stagnationAlert),
      allow_create_opportunity: allowCreate,
      allow_win_opportunity: allowWin,
      allow_lose_opportunity: allowLose,
      position: stage?.position ?? 999,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{stage ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
          <DialogDescription>
            Funil: <span className="font-medium">{pipelineName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Nome da etapa *</Label>
            <Input
              id="stage-name"
              placeholder="Ex: Proposta, Negociação, Ganho"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-description">Descrição</Label>
            <Textarea
              id="stage-description"
              placeholder="Descreva o que acontece nesta etapa..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor da etapa</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 rounded border border-input cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#000000"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className="w-6 h-6 rounded border-2 border-border hover:border-primary transition-colors"
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="probability">Probabilidade de ganho (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Qual a probabilidade de uma oportunidade ser ganha quando estiver nessa etapa?
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stagnation">Alerta de estagnação (em dias)</Label>
            <Input
              id="stagnation"
              type="number"
              min="0"
              value={stagnationAlert}
              onChange={(e) => setStagnationAlert(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ao ativar essa configuração os cards com mais dias na etapa atual ficarão vermelhos e um ícone será exibido. A contagem de estagnação começa a partir da 00:00.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label>Permissões</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-create"
                checked={allowCreate}
                onCheckedChange={(checked) => setAllowCreate(checked as boolean)}
              />
              <label
                htmlFor="allow-create"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Permitir criar oportunidades nesta etapa.
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-win"
                checked={allowWin}
                onCheckedChange={(checked) => setAllowWin(checked as boolean)}
              />
              <label
                htmlFor="allow-win"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Permitir ganhar oportunidades nesta etapa.
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-lose"
                checked={allowLose}
                onCheckedChange={(checked) => setAllowLose(checked as boolean)}
              />
              <label
                htmlFor="allow-lose"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Permitir perder oportunidades nesta etapa.
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {stage && onDelete && (
              <Button
                variant="destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
