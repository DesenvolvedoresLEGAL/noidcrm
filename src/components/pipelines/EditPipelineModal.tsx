import { useState, useEffect } from 'react';
import { Pipeline } from '@/services/crm/types';
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
import { Checkbox } from '@/components/ui/checkbox';

interface EditPipelineModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Pipeline>) => void;
  pipeline?: Pipeline;
}

export function EditPipelineModal({ open, onClose, onSave, pipeline }: EditPipelineModalProps) {
  const [name, setName] = useState('');
  const [selectedBUs, setSelectedBUs] = useState<('ALUGUE' | 'HUMANOID')[]>(['ALUGUE']);

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      setSelectedBUs(pipeline.bu);
    } else {
      setName('');
      setSelectedBUs(['ALUGUE']);
    }
  }, [pipeline, open]);

  const toggleBU = (bu: 'ALUGUE' | 'HUMANOID') => {
    setSelectedBUs((prev) => {
      if (prev.includes(bu)) {
        // Não permitir desmarcar se for o único selecionado
        if (prev.length === 1) return prev;
        return prev.filter((b) => b !== bu);
      }
      return [...prev, bu];
    });
  };

  const handleSave = () => {
    if (!name.trim() || selectedBUs.length === 0) return;
    onSave({ name: name.trim(), bu: selectedBUs });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{pipeline ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
          <DialogDescription>
            {pipeline ? 'Edite as informações do funil de vendas.' : 'Crie um novo funil de vendas para organizar seu processo.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do funil *</Label>
            <Input
              id="name"
              placeholder="Ex: Vendas, Pré-vendas, Pós-vendas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Unidades de Negócio *</Label>
            <p className="text-xs text-muted-foreground">
              Selecione as unidades de negócio que utilizarão este funil
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bu-alugue"
                  checked={selectedBUs.includes('ALUGUE')}
                  onCheckedChange={() => toggleBU('ALUGUE')}
                />
                <label
                  htmlFor="bu-alugue"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  ALUGUE
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bu-humanoid"
                  checked={selectedBUs.includes('HUMANOID')}
                  onCheckedChange={() => toggleBU('HUMANOID')}
                />
                <label
                  htmlFor="bu-humanoid"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  HUMANOID
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || selectedBUs.length === 0}>
            {pipeline ? 'Salvar' : 'Criar Funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
