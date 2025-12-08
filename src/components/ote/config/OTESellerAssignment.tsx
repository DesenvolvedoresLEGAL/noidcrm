import { useState } from 'react';
import { useOTELevels, useOTESellerConfigs } from '@/hooks/useOTEData';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
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
import { Plus, Pencil, User } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function OTESellerAssignment() {
  const { data: levels } = useOTELevels();
  const { data: configs, isLoading, upsertConfig } = useOTESellerConfigs();
  const { users } = useOrganizationUsers();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formData, setFormData] = useState({
    ote_level_id: '',
    custom_goal_override: null as number | null,
    custom_variable_override: null as number | null,
    notes: '',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleOpenDialog = (userId?: string, existingConfig?: any) => {
    if (existingConfig) {
      setSelectedUserId(existingConfig.user_id);
      setFormData({
        ote_level_id: existingConfig.ote_level_id || '',
        custom_goal_override: existingConfig.custom_goal_override,
        custom_variable_override: existingConfig.custom_variable_override,
        notes: existingConfig.notes || '',
      });
    } else {
      setSelectedUserId(userId || '');
      setFormData({
        ote_level_id: '',
        custom_goal_override: null,
        custom_variable_override: null,
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    await upsertConfig.mutateAsync({
      user_id: selectedUserId,
      ote_level_id: formData.ote_level_id || undefined,
      custom_goal_override: formData.custom_goal_override,
      custom_variable_override: formData.custom_variable_override,
      notes: formData.notes,
      effective_date: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(false);
  };

  // Get users without OTE config
  const assignedUserIds = new Set(configs?.map(c => c.user_id) || []);
  const unassignedUsers = users?.filter(u => !assignedUserIds.has(u.id)) || [];

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Atribua níveis OTE aos vendedores ou defina metas personalizadas.
        </p>
      </div>

      {/* Assigned Sellers */}
      {configs && configs.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Vendedores Configurados</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Nível OTE</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Variável Alvo</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => {
                const user = users?.find(u => u.id === config.user_id);
                const level = config.ote_level;
                return (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user?.name || 'Vendedor'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{level?.level_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      {config.custom_goal_override 
                        ? formatCurrency(config.custom_goal_override) 
                        : level?.monthly_goal 
                          ? formatCurrency(level.monthly_goal)
                          : '-'
                      }
                      {config.custom_goal_override && (
                        <span className="text-xs text-muted-foreground ml-1">(custom)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {config.custom_variable_override 
                        ? formatCurrency(config.custom_variable_override) 
                        : level?.variable_target 
                          ? formatCurrency(level.variable_target)
                          : '-'
                      }
                      {config.custom_variable_override && (
                        <span className="text-xs text-muted-foreground ml-1">(custom)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(config.effective_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(undefined, config)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Unassigned Sellers */}
      {unassignedUsers.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Vendedores sem Configuração OTE</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {unassignedUsers.map((user) => (
              <div 
                key={user.id} 
                className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                onClick={() => handleOpenDialog(user.id)}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar OTE do Vendedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!!configs?.find(c => c.user_id === selectedUserId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nível OTE</Label>
              <Select value={formData.ote_level_id} onValueChange={(v) => setFormData({ ...formData, ote_level_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um nível" />
                </SelectTrigger>
                <SelectContent>
                  {levels?.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.level_name} - Meta: {formatCurrency(level.monthly_goal)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Personalizada (opcional)</Label>
                <Input
                  type="number"
                  value={formData.custom_goal_override || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    custom_goal_override: e.target.value ? Number(e.target.value) : null 
                  })}
                  placeholder="Usar do nível"
                />
              </div>
              <div className="space-y-2">
                <Label>Variável Personalizado (opcional)</Label>
                <Input
                  type="number"
                  value={formData.custom_variable_override || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    custom_variable_override: e.target.value ? Number(e.target.value) : null 
                  })}
                  placeholder="Usar do nível"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre esta configuração"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!selectedUserId || upsertConfig.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
