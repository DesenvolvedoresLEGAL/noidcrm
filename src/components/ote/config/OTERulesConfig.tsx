import { useState } from 'react';
import { useOTERules, OTERule } from '@/hooks/useOTEData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Check, X, Zap, TrendingUp, TrendingDown, Flag } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export function OTERulesConfig() {
  const { data: rules, isLoading, createRule, updateRule, deleteRule } = useOTERules();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OTERule | null>(null);
  const [formData, setFormData] = useState({
    rule_type: 'accelerator' as 'flag' | 'accelerator' | 'decelerator',
    rule_name: '',
    condition_field: '',
    condition_operator: '>=',
    condition_value: 0,
    condition_value_max: null as number | null,
    effect_type: 'percentage' as 'percentage' | 'fixed' | 'flag_color',
    effect_value: 0,
    effect_flag_color: null as string | null,
    priority: 0,
    is_active: true,
    description: '',
  });

  const conditionFields = [
    { value: 'roleplay_score', label: 'Score Roleplay' },
    { value: 'crm_completion', label: 'Preenchimento CRM (%)' },
    { value: 'fitscore', label: 'FitScore Médio' },
    { value: 'training_attendance', label: 'Presença Treinamento (%)' },
    { value: 'achievement_percentage', label: '% Meta Atingida' },
  ];

  const handleOpenDialog = (rule?: OTERule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        rule_type: rule.rule_type,
        rule_name: rule.rule_name,
        condition_field: rule.condition_field,
        condition_operator: rule.condition_operator,
        condition_value: rule.condition_value || 0,
        condition_value_max: rule.condition_value_max,
        effect_type: rule.effect_type || 'percentage',
        effect_value: rule.effect_value || 0,
        effect_flag_color: rule.effect_flag_color,
        priority: rule.priority,
        is_active: rule.is_active,
        description: rule.description || '',
      });
    } else {
      setEditingRule(null);
      setFormData({
        rule_type: 'accelerator',
        rule_name: '',
        condition_field: '',
        condition_operator: '>=',
        condition_value: 0,
        condition_value_max: null,
        effect_type: 'percentage',
        effect_value: 0,
        effect_flag_color: null,
        priority: (rules?.length || 0) + 1,
        is_active: true,
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...formData });
    } else {
      await createRule.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta regra?')) {
      await deleteRule.mutateAsync(id);
    }
  };

  const handleSeedDefaults = async () => {
    const defaults = [
      { rule_type: 'accelerator', rule_name: 'Roleplay Excelente', condition_field: 'roleplay_score', condition_operator: '>=', condition_value: 80, effect_type: 'percentage', effect_value: 5, priority: 1, is_active: true, description: 'Score de roleplay >= 80' },
      { rule_type: 'decelerator', rule_name: 'Roleplay Baixo', condition_field: 'roleplay_score', condition_operator: '<', condition_value: 60, effect_type: 'percentage', effect_value: 5, priority: 2, is_active: true, description: 'Score de roleplay < 60' },
      { rule_type: 'accelerator', rule_name: 'CRM Completo', condition_field: 'crm_completion', condition_operator: '>=', condition_value: 90, effect_type: 'percentage', effect_value: 3, priority: 3, is_active: true, description: 'Preenchimento CRM >= 90%' },
      { rule_type: 'decelerator', rule_name: 'CRM Incompleto', condition_field: 'crm_completion', condition_operator: '<', condition_value: 50, effect_type: 'percentage', effect_value: 3, priority: 4, is_active: true, description: 'Preenchimento CRM < 50%' },
      { rule_type: 'accelerator', rule_name: 'FitScore Alto', condition_field: 'fitscore', condition_operator: '>=', condition_value: 80, effect_type: 'percentage', effect_value: 2, priority: 5, is_active: true, description: 'FitScore médio >= 80' },
    ];

    for (const rule of defaults) {
      await createRule.mutateAsync(rule as any);
    }
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'accelerator':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decelerator':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'flag':
        return <Flag className="h-4 w-4 text-yellow-500" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure regras de aceleradores e desaceleradores baseados em performance.
        </p>
        <div className="flex gap-2">
          {(!rules || rules.length === 0) && (
            <Button variant="outline" onClick={handleSeedDefaults} size="sm">
              Carregar Padrões
            </Button>
          )}
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </div>
      </div>

      {rules && rules.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Condição</TableHead>
              <TableHead className="text-center">Efeito</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRuleIcon(rule.rule_type)}
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded",
                      rule.rule_type === 'accelerator' && "bg-green-100 text-green-800",
                      rule.rule_type === 'decelerator' && "bg-red-100 text-red-800",
                      rule.rule_type === 'flag' && "bg-yellow-100 text-yellow-800"
                    )}>
                      {rule.rule_type === 'accelerator' ? 'Acelerador' : 
                       rule.rule_type === 'decelerator' ? 'Desacelerador' : 'Flag'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{rule.rule_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {conditionFields.find(f => f.value === rule.condition_field)?.label || rule.condition_field}{' '}
                  {rule.condition_operator} {rule.condition_value}
                  {rule.condition_operator === 'between' && ` - ${rule.condition_value_max}`}
                </TableCell>
                <TableCell className="text-center">
                  {rule.effect_type === 'percentage' ? (
                    <span className={cn(
                      "font-semibold",
                      rule.rule_type === 'accelerator' && "text-green-600",
                      rule.rule_type === 'decelerator' && "text-red-600"
                    )}>
                      {rule.rule_type === 'accelerator' ? '+' : '-'}{rule.effect_value}%
                    </span>
                  ) : rule.effect_flag_color}
                </TableCell>
                <TableCell className="text-center">
                  {rule.is_active ? (
                    <Check className="h-4 w-4 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
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
          Nenhuma regra configurada. Clique em "Carregar Padrões" ou "Nova Regra".
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra OTE'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={formData.rule_type} 
                  onValueChange={(v: any) => setFormData({ ...formData, rule_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accelerator">Acelerador (+)</SelectItem>
                    <SelectItem value="decelerator">Desacelerador (-)</SelectItem>
                    <SelectItem value="flag">Flag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome da Regra</Label>
                <Input
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  placeholder="Ex: Roleplay Excelente"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Campo</Label>
                <Select 
                  value={formData.condition_field} 
                  onValueChange={(v) => setFormData({ ...formData, condition_field: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionFields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operador</Label>
                <Select 
                  value={formData.condition_operator} 
                  onValueChange={(v) => setFormData({ ...formData, condition_operator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">=">≥ (maior ou igual)</SelectItem>
                    <SelectItem value="<=">≤ (menor ou igual)</SelectItem>
                    <SelectItem value=">">{">"} (maior que)</SelectItem>
                    <SelectItem value="<">{"<"} (menor que)</SelectItem>
                    <SelectItem value="=">=  (igual)</SelectItem>
                    <SelectItem value="between">Entre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={formData.condition_value}
                  onChange={(e) => setFormData({ ...formData, condition_value: Number(e.target.value) })}
                />
              </div>
            </div>

            {formData.condition_operator === 'between' && (
              <div className="space-y-2">
                <Label>Valor Máximo</Label>
                <Input
                  type="number"
                  value={formData.condition_value_max || ''}
                  onChange={(e) => setFormData({ ...formData, condition_value_max: Number(e.target.value) })}
                />
              </div>
            )}

            {formData.rule_type !== 'flag' ? (
              <div className="space-y-2">
                <Label>Efeito (%)</Label>
                <Input
                  type="number"
                  value={formData.effect_value}
                  onChange={(e) => setFormData({ ...formData, effect_value: Number(e.target.value) })}
                  placeholder="Ex: 5 para +5%"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cor da Flag</Label>
                <Select 
                  value={formData.effect_flag_color || ''} 
                  onValueChange={(v) => setFormData({ ...formData, effect_flag_color: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">🔵 Blue</SelectItem>
                    <SelectItem value="yellow">🟡 Yellow</SelectItem>
                    <SelectItem value="red">🔴 Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da regra"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  className="w-20"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
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
            <Button onClick={handleSave} disabled={createRule.isPending || updateRule.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
