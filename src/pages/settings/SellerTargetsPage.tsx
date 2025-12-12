import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useSellerTargets, useSalesConfig } from '@/hooks/useSalesConfig';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Target, Users, Calendar, Save, Plus, DollarSign } from 'lucide-react';
import { format, startOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function SellerTargetsPage() {
  const { organization } = useCurrentUser();
  const { config } = useSalesConfig();
  
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const { targets, upsertTarget } = useSellerTargets(selectedMonth);
  
  const [editingTargets, setEditingTargets] = useState<Record<string, any>>({});

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-targets', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          org_role,
          profiles!inner(full_name, avatar_url)
        `)
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .in('org_role', ['sales', 'manager']);
      
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Initialize editing state from targets
  useEffect(() => {
    if (targets && teamMembers) {
      const newEditingTargets: Record<string, any> = {};
      
      teamMembers.forEach((member) => {
        const existingTarget = targets.find(t => t.user_id === member.user_id);
        newEditingTargets[member.user_id] = existingTarget || {
          user_id: member.user_id,
          period_month: selectedMonth,
          monthly_revenue_target: 0,
          revenue_share: 0.25,
          daily_calls_target: 15,
          daily_leads_target: 4,
          daily_proposals_target: 3,
          daily_sales_target: 2,
          daily_revenue_target: 0,
        };
      });
      
      setEditingTargets(newEditingTargets);
    }
  }, [targets, teamMembers, selectedMonth]);

  const handleSaveTarget = async (userId: string) => {
    const target = editingTargets[userId];
    if (!target) return;
    
    await upsertTarget({
      ...target,
      period_month: selectedMonth,
    });
  };

  const handleSaveAll = async () => {
    const promises = Object.keys(editingTargets).map(userId => handleSaveTarget(userId));
    await Promise.all(promises);
    toast.success('Todas as metas foram salvas');
  };

  const updateTarget = (userId: string, field: string, value: any) => {
    setEditingTargets(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  // Calculate auto-fill values based on global target and revenue share
  const autoFillFromGlobalTarget = () => {
    if (!config?.monthly_revenue_target || !teamMembers) return;
    
    const totalSellers = teamMembers.length || 1;
    const sharePerSeller = 1 / totalSellers;
    const targetPerSeller = config.monthly_revenue_target * sharePerSeller;
    const workingDays = config.working_days_per_month || 20;
    const dailyRevenue = targetPerSeller / workingDays;
    
    const newTargets: Record<string, any> = {};
    teamMembers.forEach((member) => {
      newTargets[member.user_id] = {
        ...editingTargets[member.user_id],
        monthly_revenue_target: targetPerSeller,
        revenue_share: sharePerSeller,
        daily_revenue_target: dailyRevenue,
      };
    });
    
    setEditingTargets(prev => ({ ...prev, ...newTargets }));
    toast.info('Metas distribuídas igualmente entre os vendedores');
  };

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = addMonths(startOfMonth(new Date()), i - 3);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              Metas por Vendedor
            </h1>
            <p className="text-muted-foreground">Configure metas individuais de receita e atividades</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={autoFillFromGlobalTarget}>
              <DollarSign className="h-4 w-4 mr-1" />
              Distribuir Meta Global
            </Button>
            <Button onClick={handleSaveAll}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Todas
            </Button>
          </div>
        </div>

        {/* Month Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-64">
                <Label>Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {config && (
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Meta Global: {formatCurrency(config.monthly_revenue_target || 0)}</span>
                  <span>Ticket Médio: {formatCurrency(config.average_ticket || 0)}</span>
                  <span>Dias Úteis: {config.working_days_per_month || 20}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sellers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vendedores ({teamMembers?.length || 0})
            </CardTitle>
            <CardDescription>Configure as metas de cada vendedor para o mês selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers && teamMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Meta Mês (R$)</TableHead>
                    <TableHead className="text-right">Share (%)</TableHead>
                    <TableHead className="text-center">Ligações/dia</TableHead>
                    <TableHead className="text-center">Leads/dia</TableHead>
                    <TableHead className="text-center">Propostas/dia</TableHead>
                    <TableHead className="text-center">Vendas/dia</TableHead>
                    <TableHead className="text-right">Receita/dia</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => {
                    const target = editingTargets[member.user_id] || {};
                    const profile = member.profiles as any;
                    
                    return (
                      <TableRow key={member.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={profile?.avatar_url} />
                              <AvatarFallback>
                                {profile?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{profile?.full_name || 'Usuário'}</p>
                              <Badge variant="outline" className="text-xs">
                                {member.org_role}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={target.monthly_revenue_target || 0}
                            onChange={(e) => updateTarget(member.user_id, 'monthly_revenue_target', parseFloat(e.target.value) || 0)}
                            className="w-32 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={((target.revenue_share || 0) * 100).toFixed(0)}
                            onChange={(e) => updateTarget(member.user_id, 'revenue_share', (parseFloat(e.target.value) || 0) / 100)}
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={target.daily_calls_target || 0}
                            onChange={(e) => updateTarget(member.user_id, 'daily_calls_target', parseInt(e.target.value) || 0)}
                            className="w-16 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={target.daily_leads_target || 0}
                            onChange={(e) => updateTarget(member.user_id, 'daily_leads_target', parseInt(e.target.value) || 0)}
                            className="w-16 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={target.daily_proposals_target || 0}
                            onChange={(e) => updateTarget(member.user_id, 'daily_proposals_target', parseInt(e.target.value) || 0)}
                            className="w-16 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={target.daily_sales_target || 0}
                            onChange={(e) => updateTarget(member.user_id, 'daily_sales_target', parseInt(e.target.value) || 0)}
                            className="w-16 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={target.daily_revenue_target || 0}
                            onChange={(e) => updateTarget(member.user_id, 'daily_revenue_target', parseFloat(e.target.value) || 0)}
                            className="w-28 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveTarget(member.user_id)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum vendedor encontrado</p>
                <p className="text-sm">Adicione membros com papel "sales" ou "manager" na organização</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
