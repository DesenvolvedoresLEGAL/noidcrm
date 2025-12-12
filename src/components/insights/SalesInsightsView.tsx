import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { MissionsCard } from '@/components/gamification/MissionsCard';
import { useSalesCoach } from '@/hooks/useSalesCoach';
import { useGamification } from '@/hooks/useGamification';
import { GraduationCap, Target, Award, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { UserX } from 'lucide-react';

interface SalesInsightsViewProps {
  sellerId?: string;
  sellerRole?: string;
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
        </p>
      </CardContent>
    </Card>
  );
}

export function SalesInsightsView({ sellerId, sellerRole }: SalesInsightsViewProps) {
  const { coachData, isLoading: coachLoading } = useSalesCoach();
  const gamification = useGamification(sellerId);

  if (!sellerId) {
    return <NoSellerState />;
  }

  return (
    <div className="space-y-6">
      {/* Level Progress Card */}
      {coachData && (
        <LevelProgressCard 
          level={gamification.level} 
          sellerName={coachData.seller?.name}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="coach" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
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
        </TabsList>

        {/* Coach Tab */}
        <TabsContent value="coach" className="space-y-6">
          {coachData ? (
            <>
              <SalesCoachKPIs sellerId={sellerId} stats={coachData.stats} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SkillRadarChart skills={coachData.skills} />
                <AICoachPanel insights={coachData.coachInsights} />
              </div>
              <BehavioralTrendsChart trends={coachData.trends} />
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
        <TabsContent value="missions" className="space-y-6">
          <MissionsCard sellerId={sellerId} />
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-6">
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
        <TabsContent value="ranking" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeaderboardCard currentSellerId={sellerId} />
            <AchievementProgress 
              achievements={gamification.achievements}
              inProgress={gamification.inProgressAchievements}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
