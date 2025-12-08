import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CSDashboard() {
  const { user, organization } = useCurrentUser();
  const navigate = useNavigate();

  // Buscar clientes ativos (contas com lifecycle_stage = Cliente)
  const { data: activeClients, isLoading: loadingClients } = useQuery({
    queryKey: ['cs-active-clients', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('lifecycle_stage', 'Cliente')
        .order('data_tornou_cliente', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Buscar clientes em risco de churn (ai_scores com tipo churn_risk)
  const { data: churnRiskClients, isLoading: loadingChurn } = useQuery({
    queryKey: ['cs-churn-risk', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_scores')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social, data_tornou_cliente)
        `)
        .eq('organization_id', organization.id)
        .eq('entity_type', 'account')
        .eq('score_type', 'churn_risk')
        .gte('score', 60)
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Buscar potencial de upsell
  const { data: upsellOpportunities, isLoading: loadingUpsell } = useQuery({
    queryKey: ['cs-upsell', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_scores')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social)
        `)
        .eq('organization_id', organization.id)
        .eq('entity_type', 'account')
        .eq('score_type', 'upsell_potential')
        .gte('score', 70)
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Buscar atividades pendentes de onboarding (pipelines CS)
  const { data: pendingOnboarding, isLoading: loadingOnboarding } = useQuery({
    queryKey: ['cs-pending-onboarding', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      // Buscar pipelines do tipo CS
      const { data: csPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .ilike('name', '%cs%');
      
      if (!csPipelines || csPipelines.length === 0) return [];
      
      const pipelineIds = csPipelines.map(p => p.id);
      
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social),
          stage:stages(id, name)
        `)
        .eq('organization_id', organization.id)
        .in('pipeline_id', pipelineIds)
        .not('status', 'in', '("won","lost")')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // KPIs
  const kpis = {
    totalClients: activeClients?.length || 0,
    atRiskCount: churnRiskClients?.length || 0,
    upsellCount: upsellOpportunities?.length || 0,
    pendingOnboarding: pendingOnboarding?.length || 0
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getChurnRiskBadge = (score: number) => {
    if (score >= 80) return <Badge variant="destructive">Alto Risco</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500/20 text-yellow-500">Médio Risco</Badge>;
    return <Badge variant="secondary">Baixo</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel de Customer Success</h1>
        <p className="text-muted-foreground">
          Gestão de clientes, churn e expansão de receita
        </p>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">{kpis.totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Risco de Churn</p>
                <p className="text-2xl font-bold text-red-500">{kpis.atRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Potencial Upsell</p>
                <p className="text-2xl font-bold text-emerald-500">{kpis.upsellCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Onboarding Pendente</p>
                <p className="text-2xl font-bold">{kpis.pendingOnboarding}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Clientes em Risco */}
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Clientes em Risco de Churn
            </CardTitle>
            <CardDescription>Clientes que precisam de atenção imediata</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChurn ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : churnRiskClients && churnRiskClients.length > 0 ? (
              <div className="space-y-3">
                {churnRiskClients.map((item: any) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/accounts/${item.entity_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.account?.nome_fantasia || item.account?.razao_social}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.reasons?.slice(0, 2).join(' • ') || 'Análise em andamento'}
                      </p>
                    </div>
                    <div className="text-right">
                      {getChurnRiskBadge(item.score)}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                <p>Nenhum cliente em risco identificado!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Potencial de Upsell */}
        <Card className="border-emerald-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
              Oportunidades de Expansão
            </CardTitle>
            <CardDescription>Clientes com alto potencial de upsell/cross-sell</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUpsell ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : upsellOpportunities && upsellOpportunities.length > 0 ? (
              <div className="space-y-3">
                {upsellOpportunities.map((item: any) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/accounts/${item.entity_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.account?.nome_fantasia || item.account?.razao_social}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.recommendations?.slice(0, 1).join('') || 'Potencial identificado'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500">
                      {item.score}%
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma oportunidade de expansão identificada ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Onboarding Pendente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Clientes em Onboarding
            </CardTitle>
            <CardDescription>Novos clientes que estão no processo de implantação</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOnboarding ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : pendingOnboarding && pendingOnboarding.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingOnboarding.map((item: any) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/opportunities/${item.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.account?.nome_fantasia || item.account?.razao_social}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{item.title}</p>
                    </div>
                    <Badge variant="outline">{item.stage?.name}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                <p>Nenhum cliente em onboarding no momento</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
