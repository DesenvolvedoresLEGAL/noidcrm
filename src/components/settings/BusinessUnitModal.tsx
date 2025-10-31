import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusinessUnit } from '@/services/crm/business-units';

interface BusinessUnitModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { code: string; name: string; color: string }) => void;
  businessUnit?: BusinessUnit | null;
}

export function BusinessUnitModal({ open, onClose, onSave, businessUnit }: BusinessUnitModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (businessUnit) {
      setCode(businessUnit.code);
      setName(businessUnit.name);
      setColor(businessUnit.color);
    } else {
      setCode('');
      setName('');
      setColor('#3b82f6');
    }
  }, [businessUnit, open]);

  const handleSave = () => {
    if (!code.trim() || !name.trim()) return;
    
    onSave({
      code: code.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
      name: name.trim(),
      color,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {businessUnit ? 'Editar Unidade de Negócio' : 'Nova Unidade de Negócio'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: VENDAS"
              disabled={!!businessUnit}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Apenas letras maiúsculas, números e underscore
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vendas"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!code.trim() || !name.trim()}>
            {businessUnit ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
