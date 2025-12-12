import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaderboardCard } from '@/components/gamification/LeaderboardCard';
import { MissionsCard } from '@/components/gamification/MissionsCard';
import { BadgeShowcase } from '@/components/gamification/BadgeShowcase';
import { ManagerDashboard } from '@/components/dashboards/manager/ManagerDashboard';
import { AIBriefingCard } from './AIBriefingCard';
import { useGamification } from '@/hooks/useGamification';
import { 
  Target, 
  Trophy,
  Users,
  Brain,
  Award,
  TrendingUp,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { useManagerDashboard } from '@/hooks/useManagerDashboard';

interface ManagerInsightsViewProps {
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

export function ManagerInsightsView({ sellerId }: ManagerInsightsViewProps) {
  const { data, isLoading } = useManagerDashboard();
  const gamification = useGamification(sellerId);

  const teamGoalPercentage = data?.teamGoal?.percentage || 0;
  const teamWonDeals = data?.teamFunnel?.won || 0;
  const pendingFeedbacks = data?.atRiskSellers?.length || 0;

  return (
    <div className="space-y-6">
      {/* Coaching KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Membros do Time</p>
                <p className="text-lg font-bold">{data?.teamMembers?.length || 0}</p>
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
                <p className="text-lg font-bold">{teamGoalPercentage.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <MessageSquare className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendedores em Risco</p>
                <p className="text-lg font-bold">{pendingFeedbacks}</p>
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
                <p className="text-lg font-bold">{teamWonDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Meu Time</span>
          </TabsTrigger>
          <TabsTrigger value="coaching" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Coaching</span>
          </TabsTrigger>
          <TabsTrigger value="missions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Missões</span>
          </TabsTrigger>
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Badges</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-6">
          <ManagerDashboard />
        </TabsContent>

        <TabsContent value="coaching" className="space-y-6">
          {/* AI Team Coaching Briefing */}
          <AIBriefingCard briefingType="manager" />

          {/* Ranking do Time */}
          <LeaderboardCard currentSellerId={sellerId} />
        </TabsContent>

        <TabsContent value="missions" className="space-y-6">
          <MissionsCard sellerId={sellerId} />
        </TabsContent>

        <TabsContent value="badges" className="space-y-6">
          <BadgeShowcase 
            badges={gamification.badges} 
            badgesByCategory={gamification.badgesByCategory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
