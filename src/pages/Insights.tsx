import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesCoach } from '@/hooks/useSalesCoach';
import { useMissions } from '@/hooks/useMissions';
import { useInsightsRole } from '@/hooks/useInsightsRole';
import { OwnerInsightsView } from '@/components/insights/OwnerInsightsView';
import { ManagerInsightsView } from '@/components/insights/ManagerInsightsView';
import { SalesInsightsView } from '@/components/insights/SalesInsightsView';
import { BadgeUnlockModal } from '@/components/gamification/BadgeUnlockModal';
import { RefreshCw, AlertCircle, UserX, Brain, Users, TrendingUp, GraduationCap, Lightbulb, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/services/gamification/badges';
import { PageHeader } from '@/components/ui/page-header';

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

function getExperienceIcon(experience: string) {
  switch (experience) {
    case 'owner':
      return <Brain className="h-6 w-6 text-primary" />;
    case 'manager':
      return <Users className="h-6 w-6 text-primary" />;
    case 'finance':
      return <TrendingUp className="h-6 w-6 text-primary" />;
    default:
      return <GraduationCap className="h-6 w-6 text-primary" />;
  }
}

export default function Insights() {
  const { sellerId, coachData, isLoading: coachLoading, error, refetch, hasSeller } = useSalesCoach();
  const { trackAction } = useMissions(sellerId || undefined);
  const { experience, title, subtitle, isLoading: roleLoading } = useInsightsRole();
  const [unlockedBadge, setUnlockedBadge] = useState<Badge | null>(null);

  // Track login for daily missions
  useEffect(() => {
    if (sellerId) {
      trackAction({ action: 'login' });
    }
  }, [sellerId]);

  const handleCloseBadgeModal = () => {
    setUnlockedBadge(null);
  };

  const isLoading = coachLoading || roleLoading;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <PageHeader
          icon={Lightbulb}
          title={title}
          subtitle={subtitle}
          variant="amber"
          badge={{ label: 'AI Coach', icon: Sparkles }}
          actions={
            (experience === 'sales' || experience === 'sdr') && hasSeller ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  refetch();
                }}
                disabled={coachLoading}
                className="w-fit"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", coachLoading && "animate-spin")} />
                Atualizar Análise
              </Button>
            ) : undefined
          }
        />

        {/* Content based on experience */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : error && (experience === 'sales' || experience === 'sdr') ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <>
            {/* Owner/Admin Experience */}
            {experience === 'owner' && (
              <OwnerInsightsView sellerId={sellerId || undefined} />
            )}

            {/* Manager Experience */}
            {experience === 'manager' && (
              <ManagerInsightsView sellerId={sellerId || undefined} />
            )}

            {/* Finance Experience - uses simplified owner view for now */}
            {experience === 'finance' && (
              <OwnerInsightsView sellerId={sellerId || undefined} />
            )}

            {/* CS Experience - uses sales view for now */}
            {experience === 'cs' && (
              <SalesInsightsView sellerId={sellerId || undefined} sellerRole="cs" />
            )}

            {/* SDR Experience */}
            {experience === 'sdr' && (
              !hasSeller ? (
                <NoSellerState />
              ) : (
                <SalesInsightsView sellerId={sellerId || undefined} sellerRole="sdr" />
              )
            )}

            {/* Sales Experience (default) */}
            {experience === 'sales' && (
              !hasSeller ? (
                <NoSellerState />
              ) : (
                <SalesInsightsView sellerId={sellerId || undefined} sellerRole="sales" />
              )
            )}
          </>
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
