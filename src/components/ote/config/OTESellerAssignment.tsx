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
import { Plus, Pencil, Trash2, User, Phone, Target, Settings, Star } from 'lucide-react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerFitScoreEvaluationForm, SellerEvaluationsList } from '@/components/team/evaluations';

export function OTESellerAssignment() {
  return (
    <Tabs defaultValue="config" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="config" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Configuração OTE
        </TabsTrigger>
        <TabsTrigger value="fitscore" className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Avaliações FitScore
        </TabsTrigger>
      </TabsList>

      <TabsContent value="config">
        <SellerOTEConfig />
      </TabsContent>

      <TabsContent value="fitscore">
        <SellerFitScoreTab />
      </TabsContent>
    </Tabs>
  );
}

function SellerFitScoreTab() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Avalie os vendedores nos fatores configurados para calcular o FitScore.
        </p>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Ver Avaliações' : 'Nova Avaliação'}
        </Button>
      </div>

      {showForm ? (
        <SellerFitScoreEvaluationForm onSuccess={() => setShowForm(false)} />
      ) : (
        <SellerEvaluationsList />
      )}
    </div>
  );
}

function SellerOTEConfig() {
  const { data: levels } = useOTELevels();
  const { data: configs, isLoading, upsertConfig, deleteConfig } = useOTESellerConfigs();
  const { users } = useOrganizationUsers();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formData, setFormData] = useState({
    ote_level_id: '',
    custom_goal_override: null as number | null,
    custom_variable_override: null as number | null,
    daily_calls_target: 15,
    daily_leads_target: 4,
    daily_proposals_target: 3,
    daily_sales_target: 2,
    daily_revenue_target: 0,
    revenue_share: 0.25,
    notes: '',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // PATCH OTE 1.7.5 — formatação por tipo de meta do nível OTE.
  // Nunca formatar meta de leads como moeda.
  const formatGoalByType = (value: number | null | undefined, goalType?: string | null) => {
    if (value == null) return '-';
    if (goalType === 'leads') {
      return `${Math.round(Number(value))} leads`;
    }
    return formatCurrency(Number(value));
  };

  // Nível selecionado no modal (para alternar labels de meta por tipo).
  const selectedLevel = levels?.find((l) => l.id === formData.ote_level_id);
  const selectedGoalType: 'revenue' | 'leads' =
    ((selectedLevel as any)?.goal_type === 'leads' ? 'leads' : 'revenue');

  const handleOpenDialog = (userId?: string, existingConfig?: any) => {
    if (existingConfig) {
      setSelectedUserId(existingConfig.user_id);
      setFormData({
        ote_level_id: existingConfig.ote_level_id || '',
        custom_goal_override: existingConfig.custom_goal_override,
        custom_variable_override: existingConfig.custom_variable_override,
        daily_calls_target: existingConfig.daily_calls_target ?? 15,
        daily_leads_target: existingConfig.daily_leads_target ?? 4,
        daily_proposals_target: existingConfig.daily_proposals_target ?? 3,
        daily_sales_target: existingConfig.daily_sales_target ?? 2,
        daily_revenue_target: existingConfig.daily_revenue_target ?? 0,
        revenue_share: existingConfig.revenue_share ?? 0.25,
        notes: existingConfig.notes || '',
      });
    } else {
      setSelectedUserId(userId || '');
      setFormData({
        ote_level_id: '',
        custom_goal_override: null,
        custom_variable_override: null,
        daily_calls_target: 15,
        daily_leads_target: 4,
        daily_proposals_target: 3,
        daily_sales_target: 2,
        daily_revenue_target: 0,
        revenue_share: 0.25,
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
      daily_calls_target: formData.daily_calls_target,
      daily_leads_target: formData.daily_leads_target,
      daily_proposals_target: formData.daily_proposals_target,
      daily_sales_target: formData.daily_sales_target,
      daily_revenue_target: formData.daily_revenue_target,
      revenue_share: formData.revenue_share,
      notes: formData.notes,
      effective_date: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(false);
  };

  const assignedUserIds = new Set(configs?.map(c => c.user_id) || []);
  const unassignedUsers = users?.filter(u => !assignedUserIds.has(u.id)) || [];

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Atribua níveis OTE, metas mensais e atividades diárias para cada vendedor.
        </p>
      </div>

      {configs && configs.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Vendedores Configurados</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Nível OTE</TableHead>
                <TableHead className="text-right">Meta Mensal</TableHead>
                <TableHead className="text-center">Ligações/Dia</TableHead>
                <TableHead className="text-center">Leads/Dia</TableHead>
                <TableHead className="text-center">Propostas/Dia</TableHead>
                <TableHead className="text-center">Vendas/Dia</TableHead>
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
                      {(() => {
                        const goalType = (level as any)?.goal_type || 'revenue';
                        const effectiveGoal =
                          config.custom_goal_override ?? level?.monthly_goal ?? null;
                        return formatGoalByType(effectiveGoal, goalType);
                      })()}
                    </TableCell>
                    <TableCell className="text-center">{(config as any).daily_calls_target ?? 15}</TableCell>
                    <TableCell className="text-center">{(config as any).daily_leads_target ?? 4}</TableCell>
                    <TableCell className="text-center">{(config as any).daily_proposals_target ?? 3}</TableCell>
                    <TableCell className="text-center">{(config as any).daily_sales_target ?? 2}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(undefined, config)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (confirm(`Remover ${user?.name || 'vendedor'} da configuração OTE?`)) {
                              deleteConfig.mutate(config.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {unassignedUsers.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Vendedores sem Configuração</h4>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Metas do Vendedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!!configs?.find(c => c.user_id === selectedUserId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
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
                        {level.level_name} - Meta: {(level as any).goal_type === 'leads' 
                          ? `${level.monthly_goal} leads` 
                          : formatCurrency(level.monthly_goal)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Metas Mensais (Personalizadas)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Meta de Receita (R$)</Label>
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
                  <Label>Variável Alvo (R$)</Label>
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
                <div className="space-y-2">
                  <Label>Comissão (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(formData.revenue_share * 100).toFixed(0)}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      revenue_share: (parseFloat(e.target.value) || 0) / 100 
                    })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Metas Diárias de Atividades
              </h4>
              <div className="grid grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Ligações</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.daily_calls_target}
                    onChange={(e) => setFormData({ ...formData, daily_calls_target: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Leads</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.daily_leads_target}
                    onChange={(e) => setFormData({ ...formData, daily_leads_target: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Propostas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.daily_proposals_target}
                    onChange={(e) => setFormData({ ...formData, daily_proposals_target: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.daily_sales_target}
                    onChange={(e) => setFormData({ ...formData, daily_sales_target: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receita/Dia (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.daily_revenue_target}
                    onChange={(e) => setFormData({ ...formData, daily_revenue_target: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <Separator />

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