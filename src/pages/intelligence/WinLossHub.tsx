import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/ui/page-header';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  Sparkles,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Mail,
  Phone,
  Calculator,
  Send,
  ArrowRight,
  Zap,
  ArrowRightLeft,
  Filter,
  UserX,
  XCircle,
  LogOut,
  Trophy,
  Award,
  Quote,
  Info,
  Clock,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SellerVsClientReasonsChart } from '@/components/intelligence/SellerVsClientReasonsChart';
import { LossReasonsTrendChart } from '@/components/intelligence/LossReasonsTrendChart';
import { SmartAlertsCard } from '@/components/intelligence/SmartAlertsCard';
import { LossReasonsByCategoryChart } from '@/components/intelligence/LossReasonsByCategoryChart';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';

// Storage key for persisting revenue simulation
const REVENUE_SIMULATION_KEY = 'winloss-revenue-simulation';

// Pipeline context types and terminology
type PipelineContext = 'qualification' | 'sales' | 'onboarding';

const CONTEXT_CONFIG: Record<PipelineContext, {
  label: string;
  icon: React.ReactNode;
  wonLabel: string;
  lostLabel: string;
  wonLabelPlural: string;
  lostLabelPlural: string;
  rateLabel: string;
  color: string;
}> = {
  qualification: {
    label: 'Leads Desqualificados',
    icon: <UserX className="h-4 w-4" />,
    wonLabel: 'Lead Qualificado',
    lostLabel: 'Lead Desqualificado',
    wonLabelPlural: 'Leads Qualificados',
    lostLabelPlural: 'Leads Desqualificados',
    rateLabel: 'Taxa de Qualificação',
    color: 'text-purple-500'
  },
  sales: {
    label: 'Deals Perdidos',
    icon: <XCircle className="h-4 w-4" />,
    wonLabel: 'Deal Ganho',
    lostLabel: 'Deal Perdido',
    wonLabelPlural: 'Deals Ganhos',
    lostLabelPlural: 'Deals Perdidos',
    rateLabel: 'Win Rate',
    color: 'text-red-500'
  },
  onboarding: {
    label: 'Churns',
    icon: <LogOut className="h-4 w-4" />,
    wonLabel: 'Cliente Ativado',
    lostLabel: 'Churn',
    wonLabelPlural: 'Clientes Ativados',
    lostLabelPlural: 'Churns',
    rateLabel: 'Taxa de Ativação',
    color: 'text-orange-500'
  }
};

export default function WinLossHub() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [pipelineContext, setPipelineContext] = useState<PipelineContext>('sales');
  
  // Load persisted revenue simulation from localStorage
  const [revenueSimulation, setRevenueSimulation] = useState<any>(() => {
    try {
      const stored = localStorage.getItem(REVENUE_SIMULATION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if not expired (24h)
        if (parsed.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch {}
    return null;
  });
  
  const contextConfig = CONTEXT_CONFIG[pipelineContext];

  // Win/Loss data - with fallback to opportunities table and dynamic pipeline_type filter
  const { data: winLossData, isLoading } = useQuery({
    queryKey: ['winloss-data', organization?.id, pipelineContext],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
      
      // Get pipelines by context type
      const pipelineTypes = pipelineContext === 'onboarding' 
        ? ['onboarding', 'cs', 'renewal'] 
        : [pipelineContext];
      
      const { data: contextPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .in('pipeline_type', pipelineTypes);
      
      const pipelineIds = contextPipelines?.map(p => p.id) || [];
      
      // Fetch win_loss_records with win_reasons join
      const { data: records } = await supabase
        .from('win_loss_records')
        .select(`
          *,
          opportunity:opportunities(
            valor_previsto,
            pipeline_id,
            created_at,
            account:accounts(segmento, porte)
          ),
          reason:loss_reasons(name),
          win_reason:win_reasons(name)
        `)
        .eq('organization_id', organization.id)
        .gte('created_at', startOfYear)
        .order('created_at', { ascending: false });
      
      // Filter records by context pipelines
      const filteredRecords = records?.filter(r => 
        pipelineIds.includes((r.opportunity as any)?.pipeline_id)
      ) || [];
      
      // FALLBACK: Also fetch directly from opportunities with status won/lost
      // Use closed_at for accurate date tracking (immutable close date)
      const { data: directOpportunities } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          valor_previsto,
          status,
          pipeline_id,
          created_at,
          updated_at,
          closed_at,
          loss_reason_id,
          loss_comment,
          account:accounts(segmento, porte),
          loss_reason:loss_reasons!loss_reason_id(name, category)
        `)
        .eq('organization_id', organization.id)
        .in('status', ['won', 'lost'])
        .in('pipeline_id', pipelineIds.length > 0 ? pipelineIds : ['no-pipelines']);
      
      // Post-filter by closed_at (or updated_at/created_at fallback) >= startOfYear
      const filteredOpportunities = (directOpportunities || []).filter(opp => {
        const closeDate = new Date((opp as any).closed_at || opp.updated_at || opp.created_at);
        return closeDate >= new Date(startOfYear);
      });
      
      // Merge: use opportunities as source of truth, enrich with win_loss_records data
      const recordsByOppId = new Map(filteredRecords.map(r => [r.opportunity_id, r]));
      
      // Filter out test opportunities
      const isTestOpportunity = (title: string) => {
        const lowerTitle = (title || '').toLowerCase();
        return lowerTitle.includes('teste') || lowerTitle.includes('test');
      };
      
      const allDeals = filteredOpportunities
        .filter(opp => !isTestOpportunity(opp.title))
        .map(opp => {
          const record = recordsByOppId.get(opp.id);
          
          // Use win_loss_records sales_cycle_days if available, or calculate from closed_at
          let salesCycleDays = 0;
          
          if (record?.sales_cycle_days && record.sales_cycle_days > 0) {
            salesCycleDays = record.sales_cycle_days;
          } else {
            // Use closed_at (or updated_at fallback) as the close date
            const closedDate = new Date((opp as any).closed_at || opp.updated_at || record?.created_at);
            const createdDate = new Date(opp.created_at);
            salesCycleDays = Math.max(0, Math.floor((closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
          }
          
          return {
            id: record?.id || opp.id,
            opportunity_id: opp.id,
            outcome: opp.status as 'won' | 'lost',
            final_value: record?.final_value || opp.valor_previsto || 0,
            sales_cycle_days: salesCycleDays,
            reason_seller: record?.reason_seller || opp.loss_comment,
            competitor: record?.competitor,
            price_factor: false,
            timing_factor: false,
            feature_factor: false,
            relationship_factor: false,
            opportunity: opp,
            reason: opp.loss_reason,
            // WIN data from win_loss_records
            win_reason_id: record?.win_reason_id,
            win_reason_name: (record?.win_reason as any)?.name,
            key_differentiator: record?.key_differentiator,
            customer_feedback: record?.customer_feedback,
            recorded_by_customer: record?.recorded_by_customer,
            acceptor_name: record?.acceptor_name,
          };
        });
      
      const wins = allDeals.filter(d => d.outcome === 'won');
      const losses = allDeals.filter(d => d.outcome === 'lost');
      
      const lossReasonCounts: Record<string, number> = {};
      losses.forEach(l => {
        const reason = l.reason_seller || (l.reason as any)?.name || 'Não informado';
        lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
      });
      
      // WIN: Aggregate win reasons
      const winReasonCounts: Record<string, number> = {};
      wins.forEach(w => {
        const reason = w.win_reason_name || 'Não informado';
        winReasonCounts[reason] = (winReasonCounts[reason] || 0) + 1;
      });
      
      // WIN: Aggregate key differentiators
      const differentiatorCounts: Record<string, number> = {};
      wins.forEach(w => {
        if (w.key_differentiator) {
          const diffs = w.key_differentiator.split(',').map((d: string) => d.trim());
          diffs.forEach((diff: string) => {
            if (diff) {
              differentiatorCounts[diff] = (differentiatorCounts[diff] || 0) + 1;
            }
          });
        }
      });
      
      // WIN: Collect customer feedbacks
      const customerFeedbacks = wins
        .filter(w => w.customer_feedback && w.recorded_by_customer)
        .map(w => ({
          feedback: w.customer_feedback,
          acceptorName: w.acceptor_name || 'Cliente',
          winReason: w.win_reason_name,
          value: w.final_value,
        }))
        .slice(0, 5);
      
      // LOSS: Collect customer feedbacks from declines
      const lossFeedbacks = losses
        .filter(l => l.customer_feedback && l.recorded_by_customer)
        .map(l => ({
          feedback: l.customer_feedback,
          lossReason: (l.reason as any)?.name || l.reason_seller,
          competitor: l.competitor,
          value: l.final_value,
        }))
        .slice(0, 5);
      
      const competitorCounts: Record<string, number> = {};
      losses.filter(l => l.competitor).forEach(l => {
        competitorCounts[l.competitor!] = (competitorCounts[l.competitor!] || 0) + 1;
      });
      
      // Derive factors from loss_reason category instead of manual checkboxes
      const categoryCounts: Record<string, number> = {};
      losses.forEach(l => {
        const category = (l.reason as any)?.category;
        if (category) {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      });
      
      const factors = {
        price: (categoryCounts['price'] || 0),
        timing: (categoryCounts['timing'] || 0),
        feature: (categoryCounts['no_fit'] || 0),
        relationship: (categoryCounts['sales_process'] || 0),
        competition: (categoryCounts['competition'] || 0),
        operational: (categoryCounts['operational'] || 0),
        internal: (categoryCounts['internal'] || 0),
        other: (categoryCounts['other'] || 0),
      };
      
      const wonValue = wins.reduce((sum, w) => sum + (w.final_value || 0), 0);
      const lostValue = losses.reduce((sum, l) => sum + (l.final_value || 0), 0);
      
      // Calculate average cycle - only consider deals with valid cycle days > 0
      const validWinCycles = wins.filter(w => w.sales_cycle_days > 0);
      const validLossCycles = losses.filter(l => l.sales_cycle_days > 0);
      
      const avgCycleWon = validWinCycles.length > 0
        ? Math.round(validWinCycles.reduce((sum, w) => sum + w.sales_cycle_days, 0) / validWinCycles.length)
        : null;
      const avgCycleLost = validLossCycles.length > 0
        ? Math.round(validLossCycles.reduce((sum, l) => sum + l.sales_cycle_days, 0) / validLossCycles.length)
        : null;
      
      return {
        wins,
        losses,
        wonCount: wins.length,
        lostCount: losses.length,
        winRate: wins.length + losses.length > 0 
          ? Math.round(wins.length / (wins.length + losses.length) * 100)
          : 0,
        wonValue,
        lostValue,
        lossReasons: Object.entries(lossReasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        winReasons: Object.entries(winReasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        differentiators: Object.entries(differentiatorCounts)
          .map(([differentiator, count]) => ({ differentiator, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
        customerFeedbacks,
        competitors: Object.entries(competitorCounts)
          .map(([competitor, count]) => ({ competitor, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        factors,
        lossFeedbacks,
        avgCycleWon,
        avgCycleLost,
        validWinCyclesCount: validWinCycles.length,
        validLossCyclesCount: validLossCycles.length
      };
    },
    enabled: !!organization?.id
  });

  // Interviews data
  const { data: interviewsData, refetch: refetchInterviews } = useQuery({
    queryKey: ['winloss-interviews', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data, error } = await supabase
        .from('winloss_interviews')
        .select(`
          *,
          account:accounts(razao_social, nome_fantasia),
          contact:contacts(nome)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      const pending = data?.filter(i => i.status === 'pending').length || 0;
      const sent = data?.filter(i => i.status === 'sent').length || 0;
      const completed = data?.filter(i => i.status === 'completed').length || 0;
      
      return { interviews: data || [], pending, sent, completed };
    },
    enabled: !!organization?.id
  });

  // AI Analysis mutation
  const analyzeWinLossMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('analyze-winloss-batch', {
        body: { organizationId: organization.id, dateRange: 'year' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAiInsights(data);
      toast({
        title: 'Análise concluída',
        description: `${data.insights?.length || 0} insights gerados`
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro na análise',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  // Revenue Impact simulation - with persistence
  const simulateRevenueMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('calculate-revenue-impact', {
        body: { organizationId: organization.id, period: 'year' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRevenueSimulation(data.simulation);
      // Persist to localStorage
      try {
        localStorage.setItem(REVENUE_SIMULATION_KEY, JSON.stringify({
          data: data.simulation,
          savedAt: Date.now()
        }));
      } catch {}
      toast({
        title: 'Simulação concluída',
        description: 'Impacto em receita calculado com sucesso'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro na simulação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: async (params: { interviewType: 'win' | 'loss' | 'churn'; channel: string }) => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('winloss-interview-bot', {
        body: { 
          organizationId: organization.id,
          interviewType: params.interviewType,
          channel: params.channel
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchInterviews();
      toast({
        title: 'Entrevista criada',
        description: 'A entrevista foi agendada com sucesso'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar entrevista',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const totalFactors = winLossData 
    ? Object.values(winLossData.factors).reduce((sum, v) => sum + v, 0)
    : 0;

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <BarChart3 className="h-4 w-4" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getInsightColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-red-500/30 bg-red-500/5';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-blue-500/30 bg-blue-500/5';
    }
  };

  // Generate dynamic recommendations based on real data
  const generateRecommendations = () => {
    if (!winLossData) return { sales: [], marketing: [], product: [], revops: [] };
    
    const sales: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    const marketing: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    const product: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    const revops: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    // Sales recommendations based on loss reasons
    if (winLossData.lossReasons.length > 0) {
      const topLoss = winLossData.lossReasons[0];
      sales.push({
        title: `Treinar objeção: ${topLoss.reason}`,
        description: `${topLoss.count} perdas com este motivo - criar playbook específico`,
        priority: 'high'
      });
    }
    
    // Based on competitors
    if (winLossData.competitors.length > 0) {
      const topCompetitor = winLossData.competitors[0];
      sales.push({
        title: `Battle card: ${topCompetitor.competitor}`,
        description: `Perdemos ${topCompetitor.count} deals - mapear diferenciais`,
        priority: 'high'
      });
    }
    
    // Based on win reasons
    if (winLossData.winReasons.length > 0) {
      const topWin = winLossData.winReasons[0];
      sales.push({
        title: `Reforçar argumento: ${topWin.reason}`,
        description: `${topWin.count} deals ganhos com este fator - usar em todas as negociações`,
        priority: 'medium'
      });
    }
    
    // Marketing recommendations
    if (winLossData.differentiators.length > 0) {
      const topDiff = winLossData.differentiators[0];
      marketing.push({
        title: `Destacar: ${topDiff.differentiator}`,
        description: `Diferencial mais mencionado por clientes (${topDiff.count}x)`,
        priority: 'high'
      });
    }
    
    if (winLossData.factors.price > 0) {
      const pricePercentage = Math.round((winLossData.factors.price / winLossData.lostCount) * 100);
      if (pricePercentage > 30) {
        marketing.push({
          title: 'Comunicar valor antes do preço',
          description: `${pricePercentage}% das perdas citam preço - melhorar percepção de valor`,
          priority: 'high'
        });
      }
    }
    
    // Product recommendations based on factors
    if (winLossData.factors.feature > 0) {
      product.push({
        title: 'Features críticas para roadmap',
        description: `${winLossData.factors.feature} perdas por falta de funcionalidades`,
        priority: 'high'
      });
    }
    
    if (winLossData.differentiators.length > 0) {
      product.push({
        title: 'Manter diferenciais competitivos',
        description: `Proteger features que geram wins: ${winLossData.differentiators.slice(0, 2).map(d => d.differentiator).join(', ')}`,
        priority: 'medium'
      });
    }
    
    // RevOps recommendations
    if (winLossData.avgCycleWon !== null && winLossData.avgCycleLost !== null) {
      if (winLossData.avgCycleLost > winLossData.avgCycleWon * 1.5) {
        revops.push({
          title: 'Reduzir ciclo de vendas perdidas',
          description: `Perdas levam ${winLossData.avgCycleLost} dias vs ${winLossData.avgCycleWon} em ganhos - identificar gargalos`,
          priority: 'high'
        });
      }
    }
    
    if (winLossData.winRate < 30) {
      revops.push({
        title: 'Melhorar qualificação de leads',
        description: `Win rate de ${winLossData.winRate}% - revisar critérios de ICP`,
        priority: 'high'
      });
    }
    
    return { sales, marketing, product, revops };
  };

  const recommendations = generateRecommendations();

  return (
    <Layout>
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        icon={Activity}
        title="Win/Loss Insight Hub"
        subtitle="Análise avançada de motivos de ganho e perda com IA"
        badge={{ label: "AI Insights", icon: Sparkles }}
        variant="rose"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => simulateRevenueMutation.mutate()}
              disabled={simulateRevenueMutation.isPending}
            >
              {simulateRevenueMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Simular Impacto
            </Button>
            <Button
              onClick={() => analyzeWinLossMutation.mutate()}
              disabled={analyzeWinLossMutation.isPending}
            >
              {analyzeWinLossMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analisar com IA
            </Button>
          </div>
        }
      />

      {/* Pipeline Context Selector */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Contexto:</span>
            </div>
            <ToggleGroup 
              type="single" 
              value={pipelineContext} 
              onValueChange={(value) => value && setPipelineContext(value as PipelineContext)}
              className="justify-start"
            >
              <ToggleGroupItem value="qualification" className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Leads Desqualificados
              </ToggleGroupItem>
              <ToggleGroupItem value="sales" className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Deals Perdidos
              </ToggleGroupItem>
              <ToggleGroupItem value="onboarding" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Churns
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{contextConfig.wonLabelPlural}</p>
                <p className="text-2xl font-bold text-emerald-500">{winLossData?.wonCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{contextConfig.lostLabelPlural}</p>
                <p className="text-2xl font-bold text-red-500">{winLossData?.lostCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{contextConfig.rateLabel}</p>
                <p className="text-2xl font-bold">{winLossData?.winRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Valor {pipelineContext === 'qualification' ? 'Desqualificado' : pipelineContext === 'onboarding' ? 'Churned' : 'Perdido'}
                </p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(winLossData?.lostValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            Vendedor vs Cliente
          </TabsTrigger>
          <TabsTrigger value="interviews">Entrevistas</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Impact</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Section: Análise de Perdas */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Análise de Perdas
            </h2>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Top Motivos de Perda */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-red-500" />
                    {pipelineContext === 'qualification' 
                      ? 'Top Motivos de Desqualificação' 
                      : pipelineContext === 'onboarding' 
                        ? 'Top Motivos de Churn' 
                        : 'Top Motivos de Perda'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : winLossData?.lossReasons && winLossData.lossReasons.length > 0 ? (
                    <div className="space-y-3">
                      {winLossData.lossReasons.map((item, index) => {
                        const total = winLossData.lossReasons.reduce((sum, r) => sum + r.count, 0);
                        const percentage = Math.round((item.count / total) * 100);
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate">{item.reason}</span>
                              <span className="text-muted-foreground ml-2">{percentage}%</span>
                            </div>
                            <Progress value={percentage} className="h-2 [&>div]:bg-red-500" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">Nenhum dado de perda registrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Concorrentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-orange-500" />
                    Perdas por Concorrente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : winLossData?.competitors && winLossData.competitors.length > 0 ? (
                    <div className="space-y-3">
                      {winLossData.competitors.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <span className="font-medium text-sm">{item.competitor}</span>
                          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">Nenhum concorrente registrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>

               {/* Fatores de Perda (por Categoria) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="h-4 w-4 text-red-500" />
                    Fatores de Perda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : totalFactors > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(winLossData?.factors || {})
                        .filter(([, count]) => count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([key, count]) => {
                          const percentage = Math.round((count / totalFactors) * 100);
                          const label = LOSS_CATEGORY_LABELS[key] || key;
                          const iconMap: Record<string, { icon: any; color: string }> = {
                            price: { icon: DollarSign, color: 'text-red-500' },
                            timing: { icon: Clock, color: 'text-yellow-500' },
                            feature: { icon: Zap, color: 'text-blue-500' },
                            relationship: { icon: Users, color: 'text-purple-500' },
                            competition: { icon: Target, color: 'text-orange-500' },
                            operational: { icon: Activity, color: 'text-slate-500' },
                            internal: { icon: AlertTriangle, color: 'text-red-400' },
                            other: { icon: Info, color: 'text-gray-400' },
                          };
                          const { icon: Icon, color } = iconMap[key] || { icon: Info, color: 'text-gray-400' };
                          return (
                            <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${color}`} />
                                <span className="text-sm font-medium">{label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{percentage}%</span>
                                <Badge variant="secondary">{count}</Badge>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">Nenhum fator registrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Section: Ciclo de Venda */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {pipelineContext === 'qualification' 
                  ? 'Ciclo de Qualificação Médio' 
                  : pipelineContext === 'onboarding' 
                    ? 'Tempo até Churn' 
                    : 'Ciclo de Venda Médio'}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">
                        Calculado da data de criação da oportunidade até o fechamento (ganho/perda).
                        Baseado em {winLossData?.validWinCyclesCount || 0} ganhos e {winLossData?.validLossCyclesCount || 0} perdas com dados válidos.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-6 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <TrendingUp className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  {winLossData?.avgCycleWon !== null ? (
                    <>
                      <p className="text-3xl font-bold text-emerald-500">{winLossData?.avgCycleWon}</p>
                      <p className="text-sm text-muted-foreground">dias ({contextConfig.wonLabelPlural.toLowerCase()})</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>
                <div className="text-center p-6 rounded-lg bg-red-500/5 border border-red-500/20">
                  <TrendingDown className="h-8 w-8 mx-auto text-red-500 mb-2" />
                  {winLossData?.avgCycleLost !== null ? (
                    <>
                      <p className="text-3xl font-bold text-red-500">{winLossData?.avgCycleLost}</p>
                      <p className="text-sm text-muted-foreground">dias ({contextConfig.lostLabelPlural.toLowerCase()})</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section: Análise de Ganhos - All contexts */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {pipelineContext === 'onboarding' ? 'Análise de Ativações' : pipelineContext === 'qualification' ? 'Análise de Qualificações' : 'Análise de Ganhos'}
            </h2>
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Top Motivos de Ganho */}
                <Card className="border-emerald-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="h-4 w-4 text-emerald-500" />
                      {pipelineContext === 'onboarding' ? 'Top Motivos de Ativação' : pipelineContext === 'qualification' ? 'Top Motivos de Qualificação' : 'Top Motivos de Ganho'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : winLossData?.winReasons && winLossData.winReasons.length > 0 ? (
                      <div className="space-y-3">
                        {winLossData.winReasons.map((item: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5">
                            <span className="font-medium text-sm">{item.reason}</span>
                            <Badge className="bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum motivo registrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Diferenciais Decisivos */}
                <Card className="border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-4 w-4 text-amber-500" />
                      Diferenciais Decisivos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                      </div>
                    ) : winLossData?.differentiators && winLossData.differentiators.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {winLossData.differentiators.map((item: any, index: number) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="px-3 py-1.5 text-sm border-amber-500/30 bg-amber-500/5"
                          >
                            {item.differentiator}
                            <span className="ml-1.5 text-xs text-muted-foreground">({item.count})</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Award className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum diferencial registrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Feedback dos Clientes */}
                <Card className="border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Quote className="h-4 w-4 text-blue-500" />
                      Feedback dos Clientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                      </div>
                    ) : winLossData?.customerFeedbacks && winLossData.customerFeedbacks.length > 0 ? (
                      <div className="space-y-3 max-h-[200px] overflow-y-auto">
                        {winLossData.customerFeedbacks.map((item: any, index: number) => (
                          <div key={index} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                            <p className="text-sm italic line-clamp-2">"{item.feedback}"</p>
                            <p className="text-xs text-muted-foreground mt-1">— {item.acceptorName}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Quote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum feedback registrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

          {/* Section: Feedback das Recusas - All contexts */}
          {winLossData?.lossFeedbacks && winLossData.lossFeedbacks.length > 0 && (
            <Card className="border-rose-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-rose-500" />
                  Feedback das Recusas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {winLossData.lossFeedbacks.map((item: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <p className="text-sm italic line-clamp-2">"{item.feedback}"</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.lossReason && (
                          <Badge variant="outline" className="text-xs border-rose-500/30">{item.lossReason}</Badge>
                        )}
                        {item.competitor && (
                          <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600">
                            → {item.competitor}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section: Análise Avançada */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Análise Avançada
            </h2>
            <div className="grid lg:grid-cols-2 gap-6">
              <SmartAlertsCard 
                losses={winLossData?.losses || []}
                lossReasons={winLossData?.lossReasons || []}
                isLoading={isLoading}
                contextLabel={contextConfig.lostLabelPlural}
              />

              {organization?.id && (
                <LossReasonsByCategoryChart 
                  organizationId={organization.id}
                  pipelineContext={pipelineContext}
                />
              )}
            </div>

            <LossReasonsTrendChart 
              losses={winLossData?.losses || []}
              isLoading={isLoading}
            />
          </div>

          {/* AI Insights Section */}
          {aiInsights && (aiInsights.insights?.length > 0 || aiInsights.topStrength || aiInsights.topWeakness) && (
            <div className="space-y-6">
              {(aiInsights.topStrength || aiInsights.topWeakness || aiInsights.competitiveStrategy) && (
                <div className="grid md:grid-cols-3 gap-4">
                  {aiInsights.topStrength && (
                    <Card className="border-emerald-500/20 bg-emerald-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Trophy className="h-5 w-5 text-emerald-500 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Principal Força</p>
                            <p className="text-sm mt-1">{aiInsights.topStrength}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {aiInsights.topWeakness && (
                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Principal Fraqueza</p>
                            <p className="text-sm mt-1">{aiInsights.topWeakness}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {aiInsights.competitiveStrategy && (
                    <Card className="border-blue-500/20 bg-blue-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Estratégia Competitiva</p>
                            <p className="text-sm mt-1">{aiInsights.competitiveStrategy}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {aiInsights.insights && aiInsights.insights.length > 0 && (
                <Card className="border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-500">
                      <Sparkles className="h-5 w-5" />
                      Insights da IA
                    </CardTitle>
                    {aiInsights.summary && (
                      <CardDescription>{aiInsights.summary}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {aiInsights.insights.map((insight: any, index: number) => (
                        <div 
                          key={index}
                          className={`p-4 rounded-lg border ${getInsightColor(insight.impact)}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm">{insight.title}</h4>
                                {insight.category && (
                                  <Badge variant="outline" className={`text-xs ${
                                    insight.category === 'win' ? 'border-emerald-500/30 text-emerald-600' :
                                    insight.category === 'loss' ? 'border-red-500/30 text-red-600' :
                                    'border-muted-foreground/30'
                                  }`}>
                                    {insight.category === 'win' ? 'WIN' : insight.category === 'loss' ? 'LOSS' : 'GERAL'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                              {insight.metric && (
                                <Badge variant="secondary" className="mt-2">{insight.metric}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {aiInsights.actionItems && aiInsights.actionItems.length > 0 && (
                      <div className="pt-4 border-t">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Ações Recomendadas
                        </h4>
                        <div className="space-y-2">
                          {aiInsights.actionItems.map((action: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <span>{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Seller vs Client Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          {organization?.id && (
            <SellerVsClientReasonsChart organizationId={organization.id} pipelineContext={pipelineContext} />
          )}
        </TabsContent>

        {/* Interviews Tab */}
        <TabsContent value="interviews" className="space-y-6">
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  As entrevistas são agendadas no sistema mas <strong>não são enviadas automaticamente</strong>. 
                  A integração com WhatsApp/Email requer configuração adicional.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold">{interviewsData?.pending || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Send className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agendadas</p>
                    <p className="text-2xl font-bold">{interviewsData?.sent || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completadas</p>
                    <p className="text-2xl font-bold">{interviewsData?.completed || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agendar Nova Entrevista</CardTitle>
              <CardDescription>
                Configure entrevistas para coleta manual de feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => createInterviewMutation.mutate({ interviewType: 'win', channel: 'whatsapp' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    <span className="font-medium">Entrevista Win</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Entenda o que fez o cliente escolher você
                  </p>
                </div>
                
                <div className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => createInterviewMutation.mutate({ interviewType: 'loss', channel: 'whatsapp' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Entrevista Loss</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Descubra os reais motivos da perda
                  </p>
                </div>
                
                <div className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => createInterviewMutation.mutate({ interviewType: 'churn', channel: 'email' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">Entrevista Churn</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Entenda por que o cliente cancelou
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entrevistas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {interviewsData?.interviews && interviewsData.interviews.length > 0 ? (
                <div className="space-y-3">
                  {interviewsData.interviews.slice(0, 5).map((interview: any) => (
                    <div key={interview.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {interview.interview_type === 'win' ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : interview.interview_type === 'loss' ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium">{(interview.account as any)?.nome_fantasia || (interview.account as any)?.razao_social || 'Conta'}</p>
                          <p className="text-sm text-muted-foreground">{(interview.contact as any)?.nome || 'Contato'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          interview.status === 'completed' ? 'default' :
                          interview.status === 'sent' ? 'secondary' :
                          'outline'
                        }>
                          {interview.status === 'completed' ? 'Completo' :
                           interview.status === 'sent' ? 'Agendado' :
                           interview.status === 'pending' ? 'Pendente' :
                           interview.status}
                        </Badge>
                        <Badge variant="outline">
                          {interview.channel === 'whatsapp' && <MessageSquare className="h-3 w-3" />}
                          {interview.channel === 'email' && <Mail className="h-3 w-3" />}
                          {interview.channel === 'voip' && <Phone className="h-3 w-3" />}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma entrevista agendada ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Impact Tab */}
        <TabsContent value="revenue" className="space-y-6">
          {revenueSimulation ? (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-emerald-500/20">
                  <CardHeader>
                    <CardTitle className="text-emerald-500">Simulação de Receita</CardTitle>
                    <CardDescription>Impacto potencial com melhorias</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Win Rate Atual</p>
                        <p className="text-3xl font-bold">{revenueSimulation.metrics.currentWinRate.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                        <p className="text-sm text-muted-foreground">Win Rate Projetado</p>
                        <p className="text-3xl font-bold text-emerald-500">{revenueSimulation.metrics.projectedWinRate.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="p-6 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Receita Incremental Potencial</p>
                      <p className="text-4xl font-bold text-emerald-500">
                        {formatCurrency(revenueSimulation.metrics.revenueIncrement)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">por ano</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Melhorias Sugeridas</CardTitle>
                    <CardDescription>Ações para aumentar win rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revenueSimulation.improvements && revenueSimulation.improvements.length > 0 ? (
                      <div className="space-y-4">
                        {revenueSimulation.improvements.map((imp: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{imp.area}</p>
                                <Badge variant={
                                  imp.difficulty === 'low' ? 'default' :
                                  imp.difficulty === 'medium' ? 'secondary' :
                                  'destructive'
                                }>
                                  +{imp.potentialImpact}%
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{imp.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Sem melhorias identificadas
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Métricas Detalhadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Total de Deals</p>
                      <p className="text-2xl font-bold">{revenueSimulation.metrics.totalDeals}</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Receita Atual</p>
                      <p className="text-2xl font-bold">{formatCurrency(revenueSimulation.metrics.currentRevenue)}</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Receita Perdida</p>
                      <p className="text-2xl font-bold text-red-500">{formatCurrency(revenueSimulation.metrics.lostRevenue)}</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold">{formatCurrency(revenueSimulation.metrics.avgDealValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => simulateRevenueMutation.mutate()}
                  disabled={simulateRevenueMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${simulateRevenueMutation.isPending ? 'animate-spin' : ''}`} />
                  Atualizar Simulação
                </Button>
              </div>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Simulador de Impacto em Receita</h3>
                <p className="text-muted-foreground mb-4">
                  Calcule o potencial de receita adicional com melhorias no win rate
                </p>
                <Button
                  onClick={() => simulateRevenueMutation.mutate()}
                  disabled={simulateRevenueMutation.isPending}
                >
                  {simulateRevenueMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Gerar Simulação
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recommendations Tab - Now Dynamic */}
        <TabsContent value="recommendations" className="space-y-6">
          {!winLossData || (winLossData.wonCount === 0 && winLossData.lostCount === 0) ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Recomendações Inteligentes</h3>
                <p className="text-muted-foreground">
                  As recomendações são geradas automaticamente com base nos dados de wins e losses.
                  Registre mais resultados para obter insights personalizados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Para Vendas
                  </CardTitle>
                  <CardDescription>Ações baseadas em padrões de win/loss</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.sales.length > 0 ? (
                    recommendations.sales.map((rec, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${
                        rec.priority === 'high' ? 'border-red-500/30 bg-red-500/5' :
                        rec.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-muted'
                      }`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                            {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Mais dados necessários para gerar recomendações
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    Para Marketing
                  </CardTitle>
                  <CardDescription>Insights de mensagem e posicionamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.marketing.length > 0 ? (
                    recommendations.marketing.map((rec, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${
                        rec.priority === 'high' ? 'border-red-500/30 bg-red-500/5' :
                        rec.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-muted'
                      }`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                            {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Mais dados necessários para gerar recomendações
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Para Produto
                  </CardTitle>
                  <CardDescription>Features e diferenciais competitivos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.product.length > 0 ? (
                    recommendations.product.map((rec, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${
                        rec.priority === 'high' ? 'border-red-500/30 bg-red-500/5' :
                        rec.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-muted'
                      }`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                            {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Mais dados necessários para gerar recomendações
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-500" />
                    Para RevOps
                  </CardTitle>
                  <CardDescription>Otimização de pipeline e processos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.revops.length > 0 ? (
                    recommendations.revops.map((rec, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${
                        rec.priority === 'high' ? 'border-red-500/30 bg-red-500/5' :
                        rec.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-muted'
                      }`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                            {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Mais dados necessários para gerar recomendações
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
