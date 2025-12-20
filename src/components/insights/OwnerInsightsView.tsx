import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardCard } from '@/components/gamification/LeaderboardCard';
import { MissionsCard } from '@/components/gamification/MissionsCard';
import { BadgeShowcase } from '@/components/gamification/BadgeShowcase';
import { AIBriefingCard } from './AIBriefingCard';
import { MastermindHub } from './MastermindHub';
import { TeamOverviewSection } from './sections/TeamOverviewSection';
import { TeamMembersSection } from './sections/TeamMembersSection';
import { CoachingSection } from './sections/CoachingSection';
import { useGamification } from '@/hooks/useGamification';
import { useManagerDashboard } from '@/hooks/useManagerDashboard';
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-12 w-96" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}

export function OwnerInsightsView({ sellerId }: OwnerInsightsViewProps) {
  const { data: ownerData, isLoading: ownerLoading } = useOwnerDashboard();
  const { data: managerData, isLoading: managerLoading } = useManagerDashboard();
  const gamification = useGamification(sellerId);

  const isLoading = ownerLoading || managerLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Calculate derived values from available data
  const totalPipeline = ownerData?.metrics?.openDealsCount 
    ? (ownerData?.sellerProductivity?.reduce((sum, s) => sum + s.revenue, 0) || 0) * 2 
    : 0;
  const closedThisMonth = ownerData?.revenue?.closedRevenue || 0;
  const atRiskDeals = ownerData?.churnRisk?.length || 0;
  const activeSellers = ownerData?.sellerProductivity?.length || 0;
  const avgWinRate = ownerData?.sellerProductivity?.length 
    ? ownerData.sellerProductivity.reduce((sum, s) => sum + s.winRate, 0) / ownerData.sellerProductivity.length 
    : 0;
  const avgSalesCycle = ownerData?.crmHeatmap?.reduce((sum, s) => sum + s.avgDays, 0) || 0;

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

      {/* Single Level Tabs - No Nesting */}
      <Tabs defaultValue="mastermind" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl bg-muted/50 p-1">
          <TabsTrigger value="mastermind" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Mastermind</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-background">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Meu Time</span>
          </TabsTrigger>
          <TabsTrigger value="coaching" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Coaching</span>
          </TabsTrigger>
          <TabsTrigger value="gamification" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
        </TabsList>

        {/* Mastermind Tab */}
        <TabsContent value="mastermind" className="mt-6">
          <MastermindHub />
        </TabsContent>

        {/* Dashboard Tab - KPIs + Charts (uses manager data for team metrics) */}
        <TabsContent value="dashboard" className="mt-6">
          {managerData ? (
            <TeamOverviewSection data={managerData} />
          ) : (
            <div className="space-y-6">
              <AIBriefingCard briefingType="owner" />
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
            </div>
          )}
        </TabsContent>

        {/* Meu Time Tab - Member Grid + Ranking */}
        <TabsContent value="team" className="mt-6">
          {managerData ? (
            <TeamMembersSection data={managerData} />
          ) : (
            <Card className="p-8 text-center">
              <Users className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Dados do time não disponíveis</p>
            </Card>
          )}
        </TabsContent>

        {/* Coaching Tab - AI Coaching + Alerts */}
        <TabsContent value="coaching" className="mt-6">
          {managerData ? (
            <CoachingSection data={managerData} />
          ) : (
            <Card className="p-8 text-center">
              <Brain className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Dados de coaching não disponíveis</p>
            </Card>
          )}
        </TabsContent>

        {/* Gamification Tab - Missions + Badges + Leaderboard */}
        <TabsContent value="gamification" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissionsCard sellerId={sellerId} />
              <LeaderboardCard currentSellerId={sellerId} />
            </div>
            <BadgeShowcase 
              badges={gamification.badges} 
              badgesByCategory={gamification.badgesByCategory}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
