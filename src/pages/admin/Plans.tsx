import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Brain, 
  Bot, 
  Zap, 
  Users, 
  Building2, 
  TrendingUp,
  Search,
  RefreshCcw,
  Settings,
  BarChart3,
  Check,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Plan {
  id: string;
  name: string;
  price_month_cents: number;
  price_year_cents: number;
  features: any;
  is_public: boolean;
  visible_in_ui: boolean;
  trial_days: number;
  display_order: number;
}

interface PlanEntitlement {
  id: string;
  plan_id: string;
  key: string;
  value: string;
}

interface OrgByPlan {
  plan_id: string;
  count: number;
  trial_count: number;
  active_count: number;
}

export default function AdminPlans() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Fetch plans
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Fetch entitlements
  const { data: entitlements, isLoading: entitlementsLoading } = useQuery({
    queryKey: ['admin-plan-entitlements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_entitlements')
        .select('*')
        .order('key', { ascending: true });
      
      if (error) throw error;
      return data as PlanEntitlement[];
    },
  });

  // Fetch orgs by plan stats
  const { data: orgStats } = useQuery({
    queryKey: ['admin-orgs-by-plan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('current_plan_id, status');
      
      if (error) throw error;
      
      // Aggregate by plan
      const stats: Record<string, OrgByPlan> = {};
      (data || []).forEach((org: any) => {
        const planId = org.current_plan_id || 'freemium';
        if (!stats[planId]) {
          stats[planId] = { plan_id: planId, count: 0, trial_count: 0, active_count: 0 };
        }
        stats[planId].count++;
        if (org.status === 'trial') stats[planId].trial_count++;
        if (org.status === 'active') stats[planId].active_count++;
      });
      
      return Object.values(stats);
    },
  });

  const getPlanIcon = (planId: string) => {
    if (planId === 'autonomous') return <Bot className="w-5 h-5 text-purple-500" />;
    if (planId === 'neural') return <Brain className="w-5 h-5 text-blue-500" />;
    return <Zap className="w-5 h-5 text-gray-500" />;
  };

  const getPlanColor = (planId: string) => {
    if (planId === 'autonomous') return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
    if (planId === 'neural') return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
  };

  const getEntitlementsForPlan = (planId: string) => {
    return entitlements?.filter(e => e.plan_id === planId) || [];
  };

  const getOrgStatsForPlan = (planId: string) => {
    return orgStats?.find(s => s.plan_id === planId) || { count: 0, trial_count: 0, active_count: 0 };
  };

  const filteredPlans = plans?.filter(plan => 
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Planos</h1>
          <p className="text-muted-foreground">
            Configure planos, entitlements e visualize métricas
          </p>
        </div>
        <Button onClick={() => refetchPlans()} variant="outline" className="gap-2">
          <RefreshCcw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['neural', 'autonomous', 'freemium'].map((planId) => {
          const stats = getOrgStatsForPlan(planId);
          const plan = plans?.find(p => p.id === planId);
          
          return (
            <motion.div
              key={planId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`border-2 ${selectedPlan === planId ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPlanIcon(planId)}
                      <CardTitle className="text-lg capitalize">{planId}</CardTitle>
                    </div>
                    <Badge variant="outline" className={getPlanColor(planId)}>
                      {stats.count} orgs
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Em Trial</p>
                      <p className="text-lg font-bold text-amber-500">{stats.trial_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ativos</p>
                      <p className="text-lg font-bold text-emerald-500">{stats.active_count}</p>
                    </div>
                  </div>
                  {plan && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      <p className="text-muted-foreground">
                        R${(plan.price_month_cents / 100).toFixed(2)}/mês • {plan.trial_days}d trial
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans" className="gap-2">
            <Settings className="w-4 h-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="entitlements" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Entitlements
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-2">
            <Building2 className="w-4 h-4" />
            Organizações
          </TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Planos Configurados</CardTitle>
                  <CardDescription>Lista de todos os planos do sistema</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar planos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Preço Mensal</TableHead>
                      <TableHead>Preço Anual</TableHead>
                      <TableHead>Trial</TableHead>
                      <TableHead>Público</TableHead>
                      <TableHead>Visível</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlans?.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPlanIcon(plan.id)}
                            <div>
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">{plan.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          R${(plan.price_month_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          R${(plan.price_year_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{plan.trial_days}d</Badge>
                        </TableCell>
                        <TableCell>
                          {plan.is_public ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          {plan.visible_in_ui ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entitlements Tab */}
        <TabsContent value="entitlements">
          <Card>
            <CardHeader>
              <CardTitle>Entitlements por Plano</CardTitle>
              <CardDescription>
                Features e limites configurados para cada plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entitlementsLoading ? (
                <div className="h-64 bg-muted/30 rounded animate-pulse" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Feature</TableHead>
                        {plans?.map(plan => (
                          <TableHead key={plan.id} className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getPlanIcon(plan.id)}
                              <span>{plan.name}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Get unique keys */}
                      {Array.from(new Set(entitlements?.map(e => e.key) || [])).map(key => (
                        <TableRow key={key}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {key}
                          </TableCell>
                          {plans?.map(plan => {
                            const ent = entitlements?.find(e => e.plan_id === plan.id && e.key === key);
                            const value = ent?.value;
                            
                            return (
                              <TableCell key={plan.id} className="text-center">
                                {value === 'true' ? (
                                  <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                ) : value === 'false' ? (
                                  <X className="w-4 h-4 text-muted-foreground mx-auto" />
                                ) : value ? (
                                  <Badge variant="outline">{value}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations">
          <Card>
            <CardHeader>
              <CardTitle>Organizações por Plano</CardTitle>
              <CardDescription>
                Distribuição de organizações entre os planos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {orgStats?.map((stat) => (
                  <div 
                    key={stat.plan_id}
                    className="p-4 rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {getPlanIcon(stat.plan_id)}
                      <h3 className="font-semibold capitalize">{stat.plan_id}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{stat.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Em Trial</span>
                        <span className="font-medium text-amber-500">{stat.trial_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ativos (pagando)</span>
                        <span className="font-medium text-emerald-500">{stat.active_count}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Conversão Trial</span>
                        <span className="font-medium">
                          {stat.trial_count > 0 
                            ? ((stat.active_count / (stat.trial_count + stat.active_count)) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
