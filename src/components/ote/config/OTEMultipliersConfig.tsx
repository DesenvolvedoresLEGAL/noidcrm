import { useState } from 'react';
import { useOTEMultipliers, OTEMultiplier } from '@/hooks/useOTEData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function OTEMultipliersConfig() {
  const { data: multipliers, isLoading, createMultiplier, updateMultiplier, deleteMultiplier } = useOTEMultipliers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMultiplier, setEditingMultiplier] = useState<OTEMultiplier | null>(null);
  const [formData, setFormData] = useState({
    min_percentage: 0,
    max_percentage: 0,
    multiplier: 0,
    description: '',
    order_index: 0,
  });

  const handleOpenDialog = (multiplier?: OTEMultiplier) => {
    if (multiplier) {
      setEditingMultiplier(multiplier);
      setFormData({
        min_percentage: multiplier.min_percentage,
        max_percentage: multiplier.max_percentage,
        multiplier: multiplier.multiplier,
        description: multiplier.description || '',
        order_index: multiplier.order_index,
      });
    } else {
      setEditingMultiplier(null);
      setFormData({
        min_percentage: 0,
        max_percentage: 0,
        multiplier: 0,
        description: '',
        order_index: (multipliers?.length || 0) + 1,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingMultiplier) {
      await updateMultiplier.mutateAsync({ id: editingMultiplier.id, ...formData });
    } else {
      await createMultiplier.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este multiplicador?')) {
      await deleteMultiplier.mutateAsync(id);
    }
  };

  const handleSeedDefaults = async () => {
    const defaults = [
      { min_percentage: 0, max_percentage: 50, multiplier: 0, description: 'Não atinge mínimo' },
      { min_percentage: 51, max_percentage: 69, multiplier: 0.25, description: 'Abaixo da meta' },
      { min_percentage: 70, max_percentage: 84, multiplier: 0.75, description: 'Próximo da meta' },
      { min_percentage: 85, max_percentage: 99, multiplier: 1, description: 'Quase na meta' },
      { min_percentage: 100, max_percentage: 119, multiplier: 1.25, description: 'Meta atingida' },
      { min_percentage: 120, max_percentage: 149, multiplier: 1.5, description: 'Superou meta' },
      { min_percentage: 150, max_percentage: 999, multiplier: 2, description: 'Excelente performance' },
    ];

    for (let i = 0; i < defaults.length; i++) {
      await createMultiplier.mutateAsync({ ...defaults[i], order_index: i + 1 });
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure as faixas de % de meta e seus multiplicadores correspondentes.
        </p>
        <div className="flex gap-2">
          {(!multipliers || multipliers.length === 0) && (
            <Button variant="outline" onClick={handleSeedDefaults} size="sm">
              Carregar Padrões
            </Button>
          )}
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Faixa
          </Button>
        </div>
      </div>

      {multipliers && multipliers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faixa % Meta</TableHead>
              <TableHead className="text-center">Multiplicador</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {multipliers.map((mult) => (
              <TableRow key={mult.id}>
                <TableCell>
                  {mult.min_percentage}% - {mult.max_percentage}%
                </TableCell>
                <TableCell className="text-center font-semibold">
                  {mult.multiplier}x
                </TableCell>
                <TableCell className="text-muted-foreground">{mult.description}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(mult)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(mult.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-8 text-center text-muted-foreground border rounded-lg">
          Nenhum multiplicador configurado. Clique em "Carregar Padrões" ou "Nova Faixa".
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMultiplier ? 'Editar Multiplicador' : 'Nova Faixa de Multiplicador'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>% Mínimo</Label>
                <Input
                  type="number"
                  value={formData.min_percentage}
                  onChange={(e) => setFormData({ ...formData, min_percentage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>% Máximo</Label>
                <Input
                  type="number"
                  value={formData.max_percentage}
                  onChange={(e) => setFormData({ ...formData, max_percentage: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Multiplicador</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.multiplier}
                onChange={(e) => setFormData({ ...formData, multiplier: Number(e.target.value) })}
                placeholder="Ex: 1.25"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da faixa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createMultiplier.isPending || updateMultiplier.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
