import { useTeamDashboard } from '@/hooks/useTeamDashboard';
import { TeamKPIsCard } from './TeamKPIsCard';
import { TeamRankingCard } from './TeamRankingCard';
import { TeamMembersList } from './TeamMembersList';
import { AICoachingPanel } from './AICoachingPanel';
import { PerformanceAlertsCard } from './PerformanceAlertsCard';
import { WeeklyDigestCard } from './WeeklyDigestCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Users, AlertCircle, LayoutDashboard, Brain, Bell } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[400px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    </div>
  );
}

export function TeamDashboardTab() {
  const { members, kpis, ranking, loading, error, refetch, teamGoal, teamName } = useTeamDashboard();

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar os dados do time.
          </p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!kpis || members.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum membro no time</h3>
          <p className="text-muted-foreground">
            Adicione membros ao seu time para ver as métricas consolidadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform members for coaching panel
  const coachingMembers = members.map(m => ({
    id: m.user_id,
    name: m.full_name,
    avatar_url: m.avatar_url || undefined,
    opportunities_count: m.opportunities_count,
    pipeline_value: m.opportunities_value,
    won_value: m.won_value,
    activities_count: m.activities_completed + m.activities_pending,
    conversion_rate: m.conversion_rate,
    goal_progress: teamGoal > 0 ? (m.won_value / (teamGoal / members.length)) * 100 : 0
  }));

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dashboard do Time</h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada da performance do seu time
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <TeamKPIsCard kpis={kpis} />

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Coaching
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <TeamRankingCard ranking={ranking} />
            </div>
            <div className="lg:col-span-2">
              <TeamMembersList members={members} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="coaching" className="mt-6">
          <AICoachingPanel teamMembers={coachingMembers} teamGoal={teamGoal} />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PerformanceAlertsCard teamMembers={coachingMembers} teamGoal={teamGoal} />
            <WeeklyDigestCard 
              teamName={teamName || 'Meu Time'} 
              teamMembers={coachingMembers} 
              teamGoal={teamGoal} 
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
