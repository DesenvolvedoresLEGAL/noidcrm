import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AIBriefingCard } from './AIBriefingCard';
import { MastermindHub } from './MastermindHub';
import { TeamOverviewSection } from './sections/TeamOverviewSection';
import { TeamMembersSection } from './sections/TeamMembersSection';
import { CoachingSection } from './sections/CoachingSection';
import { GamificationSection } from './sections/GamificationSection';
import { useGamification } from '@/hooks/useGamification';
import { 
  Brain, 
  BarChart3,
  Users,
  Target,
  Trophy,
  TrendingUp,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useManagerDashboard } from '@/hooks/useManagerDashboard';
import { formatCurrencyFull } from '@/lib/i18n';

interface ManagerInsightsViewProps {
  sellerId?: string;
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

export function ManagerInsightsView({ sellerId }: ManagerInsightsViewProps) {
  const { data, isLoading, error } = useManagerDashboard();
  const gamification = useGamification(sellerId);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto mb-4 text-destructive" />
        <p className="text-lg font-medium mb-2">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">{error?.message || 'Tente novamente mais tarde'}</p>
      </Card>
    );
  }

  const teamGoalPercentage = data.teamGoal?.percentage || 0;
  const teamWonDeals = data.teamFunnel?.won || 0;
  const atRiskCount = data.atRiskSellers?.length || 0;
  const teamMembersCount = data.teamMembers?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header KPIs - Strategic Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Membros</p>
                <p className="text-xl font-bold">{teamMembersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta do Time</p>
                <p className="text-xl font-bold">{teamGoalPercentage.toFixed(0)}%</p>
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
                <p className="text-xs text-muted-foreground">Em Risco</p>
                <p className="text-xl font-bold">{atRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deals Fechados</p>
                <p className="text-xl font-bold">{teamWonDeals}</p>
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

        {/* Dashboard Tab - KPIs + Charts */}
        <TabsContent value="dashboard" className="mt-6">
          <TeamOverviewSection data={data} />
        </TabsContent>

        {/* Meu Time Tab - Member Grid + Ranking */}
        <TabsContent value="team" className="mt-6">
          <TeamMembersSection data={data} />
        </TabsContent>

        {/* Coaching Tab - AI Coaching + Alerts */}
        <TabsContent value="coaching" className="mt-6">
          <CoachingSection data={data} />
        </TabsContent>

        {/* Gamification Tab - Missions + Badges + Leaderboard */}
        <TabsContent value="gamification" className="mt-6">
          <GamificationSection 
            sellerId={sellerId}
            badges={gamification.badges}
            badgesByCategory={gamification.badgesByCategory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
