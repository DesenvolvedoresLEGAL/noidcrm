import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaderboardCard } from '@/components/gamification/LeaderboardCard';
import { MissionsCard } from '@/components/gamification/MissionsCard';
import { ManagerDashboard } from '@/components/dashboards/manager/ManagerDashboard';
import { AIBriefingCard } from './AIBriefingCard';
import { MastermindHub } from './MastermindHub';
import { 
  BarChart3, 
  Target, 
  Trophy,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Brain
} from 'lucide-react';
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard';

interface OwnerInsightsViewProps {
  sellerId?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function OwnerInsightsView({ sellerId }: OwnerInsightsViewProps) {
  const { data, isLoading } = useOwnerDashboard();

  // Calculate derived values from available data
  const totalPipeline = data?.metrics?.openDealsCount 
    ? (data?.sellerProductivity?.reduce((sum, s) => sum + s.revenue, 0) || 0) * 2 
    : 0;
  const closedThisMonth = data?.revenue?.closedRevenue || 0;
  const atRiskDeals = data?.churnRisk?.length || 0;
  const activeSellers = data?.sellerProductivity?.length || 0;
  const avgWinRate = data?.sellerProductivity?.length 
    ? data.sellerProductivity.reduce((sum, s) => sum + s.winRate, 0) / data.sellerProductivity.length 
    : 0;
  const avgSalesCycle = data?.crmHeatmap?.reduce((sum, s) => sum + s.avgDays, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Strategic KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Total</p>
                <p className="text-lg font-bold">{formatCurrency(totalPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fechado Mês</p>
                <p className="text-lg font-bold">{formatCurrency(closedThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deals em Risco</p>
                <p className="text-lg font-bold">{atRiskDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendedores Ativos</p>
                <p className="text-lg font-bold">{activeSellers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mastermind" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="mastermind" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Mastermind</span>
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="missions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Missões</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Time</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mastermind" className="space-y-6">
          <MastermindHub />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          {/* AI Strategic Briefing */}
          <AIBriefingCard briefingType="owner" />

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Win Rate Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgWinRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ciclo Médio de Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgSalesCycle} dias</div>
                <p className="text-xs text-muted-foreground">Do primeiro contato ao fechamento</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="missions" className="space-y-6">
          <MissionsCard sellerId={sellerId} />
        </TabsContent>

        <TabsContent value="ranking" className="space-y-6">
          <LeaderboardCard currentSellerId={sellerId} />
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <ManagerDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
