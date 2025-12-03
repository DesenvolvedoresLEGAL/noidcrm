import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesCoach } from '@/hooks/useSalesCoach';
import { SalesCoachKPIs } from '@/components/sales-coach/SalesCoachKPIs';
import { SkillRadarChart } from '@/components/sales-coach/SkillRadarChart';
import { AICoachPanel } from '@/components/sales-coach/AICoachPanel';
import { LearningPathCard } from '@/components/sales-coach/LearningPathCard';
import { BehavioralTrendsChart } from '@/components/sales-coach/BehavioralTrendsChart';
import { DevelopmentPlanCard } from '@/components/sales-coach/DevelopmentPlanCard';
import { GraduationCap, RefreshCw, AlertCircle, UserX } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[350px] rounded-xl" />
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
      <Skeleton className="h-[250px] rounded-xl" />
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
        ) : !hasSeller ? (
          <NoSellerState />
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : coachData ? (
          <div className="space-y-6">
            {/* KPIs */}
            <SalesCoachKPIs sellerId={sellerId!} stats={coachData.stats} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Skill Radar */}
              <SkillRadarChart skills={coachData.skills} />
              
              {/* AI Coach Panel */}
              <AICoachPanel insights={coachData.coachInsights} />
            </div>

            {/* Trends Chart */}
            <BehavioralTrendsChart trends={coachData.trends} />

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Learning Path */}
              <LearningPathCard videos={coachData.videoRecommendations} />
              
              {/* Development Plan */}
              <DevelopmentPlanCard insights={coachData.coachInsights} />
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
