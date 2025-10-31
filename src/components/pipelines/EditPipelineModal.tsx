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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { Pipeline } from '@/services/crm/types';

interface EditPipelineModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Pipeline>) => void;
  pipeline?: Pipeline;
}

export function EditPipelineModal({ open, onClose, onSave, pipeline }: EditPipelineModalProps) {
  const { businessUnits, loading: loadingBUs } = useBusinessUnits();
  const [name, setName] = useState('');
  const [selectedBUIds, setSelectedBUIds] = useState<string[]>([]);

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      // Map bu codes to business_unit_ids if available
      if (pipeline.business_unit_ids && pipeline.business_unit_ids.length > 0) {
        setSelectedBUIds(pipeline.business_unit_ids);
      } else {
        setSelectedBUIds([]);
      }
    } else {
      setName('');
      setSelectedBUIds([]);
    }
  }, [pipeline, open]);

  const toggleBU = (buId: string) => {
    setSelectedBUIds((prev) => {
      if (prev.includes(buId)) {
        // Não permitir desmarcar se for o único selecionado
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== buId);
      }
      return [...prev, buId];
    });
  };

  const handleSave = () => {
    if (!name.trim() || selectedBUIds.length === 0) return;
    onSave({ 
      name: name.trim(), 
      business_unit_ids: selectedBUIds 
    });
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
            {loadingBUs ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : businessUnits.length === 0 ? (
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Nenhuma unidade de negócio cadastrada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure as unidades de negócio em Configurações antes de criar funis.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Selecione as unidades de negócio que utilizarão este funil
                </p>
                <div className="space-y-2">
                  {businessUnits.map((bu) => (
                    <div key={bu.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`bu-${bu.id}`}
                        checked={selectedBUIds.includes(bu.id)}
                        onCheckedChange={() => toggleBU(bu.id)}
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: bu.color }}
                      />
                      <label
                        htmlFor={`bu-${bu.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {bu.name}
                      </label>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || selectedBUIds.length === 0 || businessUnits.length === 0}
          >
            {pipeline ? 'Salvar' : 'Criar Funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
