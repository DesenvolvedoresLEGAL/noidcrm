import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Calendar, Clock, Sparkles } from 'lucide-react';
import { useMissions } from '@/hooks/useMissions';
import { MissionItem } from './MissionItem';
import { Skeleton } from '@/components/ui/skeleton';

interface MissionsCardProps {
  sellerId: string | undefined;
}

export function MissionsCard({ sellerId }: MissionsCardProps) {
  const {
    dailyMissions,
    weeklyMissions,
    isLoading,
    dailyCompleted,
    dailyTotal,
    weeklyCompleted,
    weeklyTotal,
    dailyResetTime,
    weeklyResetTime,
    claimMission,
    isClaiming,
    totalUnclaimedXP,
    refetch
  } = useMissions(sellerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const handleClaim = async (missionId: string) => {
    await claimMission({ missionId });
    refetch();
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Missões
          </CardTitle>
          {totalUnclaimedXP > 0 && (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
              <Sparkles className="h-3 w-3 mr-1" />
              {totalUnclaimedXP} XP para coletar
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="daily" className="gap-2">
              <Calendar className="h-4 w-4" />
              Diárias ({dailyCompleted}/{dailyTotal})
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-2">
              <Target className="h-4 w-4" />
              Semanais ({weeklyCompleted}/{weeklyTotal})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Progresso diário</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Reseta em {dailyResetTime.hours}h {dailyResetTime.minutes}m
              </span>
            </div>
            
            {dailyMissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma missão diária disponível</p>
                <p className="text-xs">Faça uma ação para carregar suas missões</p>
              </div>
            ) : (
              dailyMissions.map(mission => (
                <MissionItem
                  key={mission.id}
                  mission={mission}
                  onClaim={handleClaim}
                  isClaiming={isClaiming}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Progresso semanal</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Reseta em {weeklyResetTime.hours}h {weeklyResetTime.minutes}m
              </span>
            </div>
            
            {weeklyMissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma missão semanal disponível</p>
                <p className="text-xs">Faça uma ação para carregar suas missões</p>
              </div>
            ) : (
              weeklyMissions.map(mission => (
                <MissionItem
                  key={mission.id}
                  mission={mission}
                  onClaim={handleClaim}
                  isClaiming={isClaiming}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
