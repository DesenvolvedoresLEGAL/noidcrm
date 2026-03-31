import { useState } from 'react';
import { useOTELevels, OTELevel } from '@/hooks/useOTEData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

export function OTELevelsConfig() {
  const { data: levels, isLoading, createLevel, updateLevel, deleteLevel } = useOTELevels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<OTELevel | null>(null);
  const [formData, setFormData] = useState({
    level_name: '',
    level_code: '',
    base_salary: 0,
    variable_target: 0,
    monthly_goal: 0,
    goal_type: 'revenue' as 'revenue' | 'leads',
    description: '',
    order_index: 0,
    is_active: true,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleOpenDialog = (level?: OTELevel) => {
    if (level) {
      setEditingLevel(level);
      setFormData({
        level_name: level.level_name,
        level_code: level.level_code,
        base_salary: level.base_salary,
        variable_target: level.variable_target,
        monthly_goal: level.monthly_goal,
        description: level.description || '',
        order_index: level.order_index,
        is_active: level.is_active,
      });
    } else {
      setEditingLevel(null);
      setFormData({
        level_name: '',
        level_code: '',
        base_salary: 0,
        variable_target: 0,
        monthly_goal: 0,
        description: '',
        order_index: (levels?.length || 0) + 1,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingLevel) {
      await updateLevel.mutateAsync({ id: editingLevel.id, ...formData });
    } else {
      await createLevel.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este nível?')) {
      await deleteLevel.mutateAsync(id);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Defina os níveis/cargos OTE com seus respectivos salários, variáveis e metas.
        </p>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Nível
        </Button>
      </div>

      {levels && levels.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Fixo</TableHead>
              <TableHead className="text-right">Variável Alvo</TableHead>
              <TableHead className="text-right">Meta Mensal</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((level) => (
              <TableRow key={level.id}>
                <TableCell>{level.order_index}</TableCell>
                <TableCell className="font-mono text-xs">{level.level_code}</TableCell>
                <TableCell className="font-medium">{level.level_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(level.base_salary)}</TableCell>
                <TableCell className="text-right">{formatCurrency(level.variable_target)}</TableCell>
                <TableCell className="text-right">{formatCurrency(level.monthly_goal)}</TableCell>
                <TableCell className="text-center">
                  {level.is_active ? (
                    <Check className="h-4 w-4 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(level)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(level.id)}>
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
          Nenhum nível OTE configurado. Clique em "Novo Nível" para começar.
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? 'Editar Nível' : 'Novo Nível OTE'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.level_code}
                  onChange={(e) => setFormData({ ...formData, level_code: e.target.value })}
                  placeholder="TRACER_05"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.level_name}
                  onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
                  placeholder="Tracer 0.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Salário Fixo</Label>
                <Input
                  type="number"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Variável Alvo</Label>
                <Input
                  type="number"
                  value={formData.variable_target}
                  onChange={(e) => setFormData({ ...formData, variable_target: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Mensal</Label>
                <Input
                  type="number"
                  value={formData.monthly_goal}
                  onChange={(e) => setFormData({ ...formData, monthly_goal: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do nível"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  className="w-20"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createLevel.isPending || updateLevel.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
