import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSalesCoach } from '@/hooks/useSalesCoach';
import { useGamification } from '@/hooks/useGamification';
import { useMissions } from '@/hooks/useMissions';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { SalesCoachKPIs } from '@/components/sales-coach/SalesCoachKPIs';
import { SkillRadarChart } from '@/components/sales-coach/SkillRadarChart';
import { AICoachPanel } from '@/components/sales-coach/AICoachPanel';
import { LearningPathCard } from '@/components/sales-coach/LearningPathCard';
import { BehavioralTrendsChart } from '@/components/sales-coach/BehavioralTrendsChart';
import { DevelopmentPlanCard } from '@/components/sales-coach/DevelopmentPlanCard';
import { LevelProgressCard } from '@/components/gamification/LevelProgressCard';
import { BadgeShowcase } from '@/components/gamification/BadgeShowcase';
import { AchievementProgress } from '@/components/gamification/AchievementProgress';
import { LeaderboardCard } from '@/components/gamification/LeaderboardCard';
import { BadgeUnlockModal } from '@/components/gamification/BadgeUnlockModal';
import { MissionsCard } from '@/components/gamification/MissionsCard';
import { TeamDashboardTab } from '@/components/team-dashboard/TeamDashboardTab';
import { GraduationCap, RefreshCw, AlertCircle, UserX, Award, TrendingUp, Target, Users } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Badge } from '@/services/gamification/badges';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[350px] rounded-xl" />
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
    </div>
  );
}

function NoSellerState() {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-6">
          <UserX className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Perfil de Vendedor Não Encontrado</h2>
        <p className="text-muted-foreground max-w-md">
          Para acessar o Sales Coach AI, você precisa ter um perfil de vendedor vinculado à sua conta.
          Entre em contato com seu administrador para configurar seu perfil.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-2 border-destructive/20">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-6 mb-6">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Erro ao Carregar Dados</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Ocorreu um erro ao carregar seus dados de desenvolvimento. Tente novamente.
        </p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar Novamente
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Insights() {
  const { profile } = useUserProfile();
  const { sellerId, coachData, isLoading, error, refetch, hasSeller } = useSalesCoach();
  const gamification = useGamification(sellerId || undefined);
  const { trackAction } = useMissions(sellerId || undefined);
  const { isTeamManager, canViewAll } = useTeamVisibility();
  const [unlockedBadge, setUnlockedBadge] = useState<Badge | null>(null);
  const [activeTab, setActiveTab] = useState('coach');

  // Determinar se deve mostrar a tab "Meu Time"
  const showTeamTab = isTeamManager || canViewAll;

  // Track login for daily missions
  useEffect(() => {
    if (sellerId) {
      trackAction({ action: 'login' });
    }
  }, [sellerId]);

  const handleCloseBadgeModal = () => {
    setUnlockedBadge(null);
  };

  // Calcular número de tabs para grid
  const tabCount = showTeamTab ? 5 : 4;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-foreground">
                  Sales Coach AI
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-0.5">
                  {profile?.full_name ? `Olá, ${profile.full_name.split(' ')[0]}!` : 'Olá!'} Seu desenvolvimento personalizado
                </p>
              </div>
            </div>
          </div>
          {coachData && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="w-fit"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Análise
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : !hasSeller && activeTab !== 'team' ? (
          <NoSellerState />
        ) : error && activeTab !== 'team' ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <div className="space-y-6">
            {/* Level Progress Card - only show if has seller data */}
            {coachData && (
              <LevelProgressCard 
                level={gamification.level} 
                sellerName={coachData.seller?.name || profile?.full_name}
              />
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={`grid w-full grid-cols-${tabCount} max-w-xl`}>
                <TabsTrigger value="coach" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  <span className="hidden sm:inline">Coach</span>
                </TabsTrigger>
                <TabsTrigger value="missions" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Missões</span>
                </TabsTrigger>
                <TabsTrigger value="badges" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <span className="hidden sm:inline">Badges</span>
                </TabsTrigger>
                <TabsTrigger value="ranking" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Ranking</span>
                </TabsTrigger>
                {showTeamTab && (
                  <TabsTrigger value="team" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Meu Time</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Coach Tab */}
              <TabsContent value="coach" className="mt-6 space-y-6">
                {coachData ? (
                  <>
                    {/* KPIs */}
                    <SalesCoachKPIs sellerId={sellerId!} stats={coachData.stats} />

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <SkillRadarChart skills={coachData.skills} />
                      <AICoachPanel insights={coachData.coachInsights} />
                    </div>

                    {/* Trends Chart */}
                    <BehavioralTrendsChart trends={coachData.trends} />

                    {/* Bottom Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <LearningPathCard videos={coachData.videoRecommendations} />
                      <DevelopmentPlanCard insights={coachData.coachInsights} />
                    </div>
                  </>
                ) : (
                  <NoSellerState />
                )}
              </TabsContent>

              {/* Missions Tab */}
              <TabsContent value="missions" className="mt-6">
                <MissionsCard sellerId={sellerId || undefined} />
              </TabsContent>

              {/* Badges Tab */}
              <TabsContent value="badges" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <BadgeShowcase 
                      badges={gamification.badges} 
                      badgesByCategory={gamification.badgesByCategory}
                    />
                  </div>
                  <div>
                    <AchievementProgress 
                      achievements={gamification.achievements}
                      inProgress={gamification.inProgressAchievements}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Ranking Tab */}
              <TabsContent value="ranking" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <LeaderboardCard currentSellerId={sellerId || undefined} />
                  <AchievementProgress 
                    achievements={gamification.achievements}
                    inProgress={gamification.inProgressAchievements}
                  />
                </div>
              </TabsContent>

              {/* Team Tab - MASTERMIND Dashboard */}
              {showTeamTab && (
                <TabsContent value="team" className="mt-6">
                  <TeamDashboardTab />
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </div>

      {/* Badge Unlock Modal */}
      <BadgeUnlockModal 
        badge={unlockedBadge} 
        onClose={handleCloseBadgeModal} 
      />
    </Layout>
  );
}
