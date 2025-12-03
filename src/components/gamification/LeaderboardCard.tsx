import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Medal, Trophy, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LeaderboardCardProps {
  currentSellerId?: string;
}

async function getLeaderboard() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, name, total_xp, current_level, current_title')
    .eq('active', true)
    .order('total_xp', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
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

export function LeaderboardCard({ currentSellerId }: LeaderboardCardProps) {
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
    staleTime: 60000,
  });

  const currentSellerPosition = currentSellerId 
    ? leaderboard.findIndex(s => s.id === currentSellerId) + 1 
    : 0;

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
          {currentSellerPosition > 0 && (
            <Badge variant="outline">
              Você: #{currentSellerPosition}
            </Badge>
          )}
        </div>
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
                "flex items-center gap-3 p-2 rounded-lg transition-all",
                isCurrentUser 
                  ? "bg-primary/10 border border-primary/30" 
                  : "hover:bg-muted/50"
              )}
            >
              {/* Position */}
              <div className="w-8 h-8 flex items-center justify-center">
                {PositionIcon ? (
                  <PositionIcon className={cn("h-5 w-5", positionColors[position])} />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    {position}
                  </span>
                )}
              </div>

              {/* Name & Title */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm truncate",
                  isCurrentUser && "text-primary"
                )}>
                  {seller.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Nv. {seller.current_level} • {seller.current_title}
                </p>
              </div>

              {/* XP */}
              <div className="text-right">
                <p className="font-bold text-sm">{seller.total_xp || 0}</p>
                <p className="text-xs text-muted-foreground">XP</p>
              </div>
            </div>
          );
        })}

        {leaderboard.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum vendedor no ranking ainda
          </p>
        )}
      </CardContent>
    </Card>
  );
}
