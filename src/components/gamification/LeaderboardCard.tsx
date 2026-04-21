import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gamificationKeys } from '@/lib/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  Crown, 
  Medal, 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Users,
  Globe,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';

interface LeaderboardCardProps {
  currentSellerId?: string;
  showScopeToggle?: boolean;
}

type LeaderboardScope = 'global' | 'team';

interface LeaderboardEntry {
  id: string;
  name: string;
  total_xp: number;
  current_level: number;
  current_title: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}

async function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, name, total_xp, current_level, current_title')
    .eq('active', true)
    .order('total_xp', { ascending: false })
    .limit(10);

  if (error) throw error;
  
  // Simulate trend data (in production, this would come from historical data)
  return (data || []).map((seller, index) => ({
    ...seller,
    trend: index < 3 ? 'up' : index > 7 ? 'down' : 'stable',
    trendValue: Math.floor(Math.random() * 3) + 1
  }));
}

async function getTeamLeaderboard(userIds: string[]): Promise<LeaderboardEntry[]> {
  if (!userIds.length) return [];
  
  const { data, error } = await supabase
    .from('sellers')
    .select('id, name, total_xp, current_level, current_title, user_id')
    .eq('active', true)
    .in('user_id', userIds)
    .order('total_xp', { ascending: false })
    .limit(10);

  if (error) throw error;
  
  return (data || []).map((seller, index) => ({
    ...seller,
    trend: index < 2 ? 'up' : index > 5 ? 'down' : 'stable',
    trendValue: Math.floor(Math.random() * 2) + 1
  }));
}

const positionIcons: Record<number, any> = {
  1: Crown,
  2: Medal,
  3: Trophy,
};

const positionColors: Record<number, string> = {
  1: 'text-amber-500',
  2: 'text-slate-400',
  3: 'text-amber-700',
};

const positionBgColors: Record<number, string> = {
  1: 'bg-amber-500/10',
  2: 'bg-slate-400/10',
  3: 'bg-amber-700/10',
};

export function LeaderboardCard({ currentSellerId, showScopeToggle = true }: LeaderboardCardProps) {
  const { isTeamManager, visibleUserIds, canViewAll } = useTeamVisibility();
  const [scope, setScope] = useState<LeaderboardScope>('global');

  // Determine if user can see team toggle
  const canToggleScope = showScopeToggle && (isTeamManager || canViewAll);

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: gamificationKeys.leaderboard(scope, visibleUserIds),
    queryFn: () => scope === 'team' && visibleUserIds 
      ? getTeamLeaderboard(visibleUserIds) 
      : getGlobalLeaderboard(),
    staleTime: 60000,
  });

  const currentSellerPosition = currentSellerId 
    ? leaderboard.findIndex(s => s.id === currentSellerId) + 1 
    : 0;

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return <ChevronUp className="h-3 w-3 text-green-500" />;
      case 'down': return <ChevronDown className="h-3 w-3 text-red-500" />;
      default: return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ranking
          </CardTitle>
          <div className="flex items-center gap-2">
            {currentSellerPosition > 0 && (
              <Badge variant="outline" className="gap-1">
                {getTrendIcon(leaderboard[currentSellerPosition - 1]?.trend)}
                #{currentSellerPosition}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Scope Toggle */}
        {canToggleScope && (
          <div className="flex gap-1 mt-3 p-1 bg-muted rounded-lg">
            <Button
              variant={scope === 'global' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 h-8 gap-1.5"
              onClick={() => setScope('global')}
            >
              <Globe className="h-3.5 w-3.5" />
              Global
            </Button>
            <Button
              variant={scope === 'team' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 h-8 gap-1.5"
              onClick={() => setScope('team')}
            >
              <Users className="h-3.5 w-3.5" />
              Meu Time
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-2">
        {leaderboard.map((seller, index) => {
          const position = index + 1;
          const PositionIcon = positionIcons[position];
          const isCurrentUser = seller.id === currentSellerId;

          return (
            <div
              key={seller.id}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg transition-all",
                isCurrentUser 
                  ? "bg-primary/10 border border-primary/30 shadow-sm" 
                  : position <= 3 
                    ? positionBgColors[position]
                    : "hover:bg-muted/50"
              )}
            >
              {/* Position with background */}
              <div className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                position <= 3 ? positionBgColors[position] : "bg-muted"
              )}>
                {PositionIcon ? (
                  <PositionIcon className={cn("h-4 w-4", positionColors[position])} />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    {position}
                  </span>
                )}
              </div>

              {/* Name & Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn(
                    "font-medium text-sm truncate",
                    isCurrentUser && "text-primary"
                  )}>
                    {seller.name}
                  </p>
                  {/* Trend indicator */}
                  <div className="flex items-center">
                    {getTrendIcon(seller.trend)}
                    {seller.trendValue && seller.trend !== 'stable' && (
                      <span className={cn(
                        "text-xs",
                        seller.trend === 'up' ? 'text-green-500' : 'text-red-500'
                      )}>
                        {seller.trendValue}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nv. {seller.current_level} • {seller.current_title}
                </p>
              </div>

              {/* XP with visual bar */}
              <div className="text-right">
                <p className="font-bold text-sm">{(seller.total_xp || 0).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">XP</p>
              </div>
            </div>
          );
        })}

        {leaderboard.length === 0 && (
          <div className="text-center py-6">
            <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {scope === 'team' 
                ? 'Nenhum membro do time no ranking ainda'
                : 'Nenhum vendedor no ranking ainda'}
            </p>
          </div>
        )}

        {/* Position indicator for users outside top 10 */}
        {currentSellerId && currentSellerPosition === 0 && leaderboard.length > 0 && (
          <div className="pt-2 border-t mt-3">
            <p className="text-xs text-center text-muted-foreground">
              Continue conquistando XP para aparecer no ranking!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
