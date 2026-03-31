import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, CheckCircle, Sparkles } from 'lucide-react';
import { Achievement } from '@/services/gamification/achievements';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface AchievementProgressProps {
  achievements: Achievement[];
  inProgress: Achievement[];
}

function getAchievementIcon(iconName: string) {
  const IconComponent = (LucideIcons as any)[
    iconName.split('-').map((s: string, i: number) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || Trophy;
  return IconComponent;
}

const categoryLabels: Record<string, string> = {
  milestone: 'Marco',
  weekly: 'Semanal',
  monthly: 'Mensal',
  special: 'Especial',
};

export function AchievementProgress({ achievements, inProgress }: AchievementProgressProps) {
  const completedCount = achievements.filter(a => a.completed).length;

  // Show in-progress first, then completed
  const sortedAchievements = [...achievements].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    const progressA = a.current_progress ? (a.current_progress / a.target_value) : 0;
    const progressB = b.current_progress ? (b.current_progress / b.target_value) : 0;
    return progressB - progressA;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Conquistas
          </CardTitle>
          <Badge variant="secondary">
            {completedCount}/{achievements.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedAchievements.slice(0, 6).map(achievement => {
          const IconComponent = getAchievementIcon(achievement.icon);
          const progress = achievement.current_progress || 0;
          const percentage = Math.min((progress / achievement.target_value) * 100, 100);

          return (
            <div 
              key={achievement.id}
              className={cn(
                "p-3 rounded-lg border transition-all",
                achievement.completed 
                  ? "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30"
                  : "bg-muted/30 border-border/50"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  achievement.completed ? "bg-amber-500/20" : "bg-muted"
                )}>
                  {achievement.completed ? (
                    <CheckCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "font-medium text-sm",
                      achievement.completed ? "text-amber-600" : "text-foreground"
                    )}>
                      {achievement.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {categoryLabels[achievement.category]}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                    {achievement.description}
                  </p>

                  {/* Progress */}
                  {!achievement.completed && (
                    <div className="space-y-1">
                      <Progress value={percentage} className="h-1.5 bg-muted [&>div]:bg-primary" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{progress}/{achievement.target_value}</span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          +{achievement.xp_reward} XP
                        </span>
                      </div>
                    </div>
                  )}

                  {achievement.completed && achievement.completed_at && (
                    <p className="text-[10px] text-amber-600">
                      Conquistado em {new Date(achievement.completed_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {achievements.length > 6 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            +{achievements.length - 6} conquistas disponíveis
          </p>
        )}
      </CardContent>
    </Card>
  );
}
