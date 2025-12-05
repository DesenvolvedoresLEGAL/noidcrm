import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TeamMemberStats } from "@/hooks/useManagerDashboard";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TeamRankingTableProps {
  members: TeamMemberStats[];
}

export function TeamRankingTable({ members }: TeamRankingTableProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-4 w-4 text-gray-400" />;
    if (index === 2) return <Trophy className="h-4 w-4 text-amber-700" />;
    return <span className="text-sm text-muted-foreground">{index + 1}º</span>;
  };

  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 100) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (percentage >= 70) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking de Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member, index) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="w-6 flex justify-center">
                {getRankBadge(index)}
              </div>
              
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{member.name}</span>
                  <div className="flex items-center gap-2">
                    {getPerformanceIcon(member.percentage)}
                    <Badge variant={member.percentage >= 100 ? "default" : member.percentage >= 70 ? "secondary" : "destructive"}>
                      {member.percentage}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(member.percentage, 100)} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatCurrency(member.achieved)} / {formatCurrency(member.monthlyGoal)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum membro do time encontrado
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
