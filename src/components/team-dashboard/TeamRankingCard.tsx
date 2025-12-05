import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TeamRankingEntry } from '@/hooks/useTeamDashboard';
import { Trophy, Medal } from 'lucide-react';

interface TeamRankingCardProps {
  ranking: TeamRankingEntry[];
  currentUserId?: string;
}

export function TeamRankingCard({ ranking, currentUserId }: TeamRankingCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: value >= 100000 ? 'compact' : 'standard',
      maximumFractionDigits: value >= 100000 ? 1 : 0,
    }).format(value);
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking do Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum dado de ranking disponível
          </p>
        ) : (
          <div className="space-y-3">
            {ranking.map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  entry.user_id === currentUserId
                    ? 'bg-primary/10 border border-primary/20'
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-center w-8">
                  {getRankBadge(entry.rank)}
                </div>
                
                <Avatar className="h-10 w-10">
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback className="text-sm font-medium">
                    {entry.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {entry.full_name}
                    {entry.user_id === currentUserId && (
                      <Badge variant="secondary" className="ml-2 text-xs">Você</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.won_count} {entry.won_count === 1 ? 'venda' : 'vendas'}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(entry.won_value)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
