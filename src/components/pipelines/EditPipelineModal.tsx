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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditPipelineModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Pipeline>) => void;
  pipeline?: Pipeline;
}

export function EditPipelineModal({ open, onClose, onSave, pipeline }: EditPipelineModalProps) {
  const [name, setName] = useState('');
  const [bu, setBu] = useState<'ALUGUE' | 'HUMANOID'>('ALUGUE');

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      setBu(pipeline.bu);
    } else {
      setName('');
      setBu('ALUGUE');
    }
  }, [pipeline, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), bu });
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

          <div className="space-y-2">
            <Label htmlFor="bu">Unidade de Negócio *</Label>
            <Select value={bu} onValueChange={(value: 'ALUGUE' | 'HUMANOID') => setBu(value)}>
              <SelectTrigger id="bu">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALUGUE">ALUGUE</SelectItem>
                <SelectItem value="HUMANOID">HUMANOID</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {pipeline ? 'Salvar' : 'Criar Funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
