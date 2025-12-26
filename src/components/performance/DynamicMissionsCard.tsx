import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Zap, Flame, TrendingUp, Clock, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicMission } from '@/services/performance/performanceScores';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DynamicMissionsCardProps {
  missions: DynamicMission[];
  isLoading?: boolean;
  onGenerateMissions?: () => void;
  isGenerating?: boolean;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  gap_close: TrendingUp,
  streak_build: Flame,
  skill_develop: Target,
  pipeline_improve: Zap,
  activity_boost: Sparkles,
};

const typeColors: Record<string, string> = {
  gap_close: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  streak_build: 'bg-red-500/10 text-red-600 border-red-500/30',
  skill_develop: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  pipeline_improve: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  activity_boost: 'bg-green-500/10 text-green-600 border-green-500/30',
};

const typeLabels: Record<string, string> = {
  gap_close: 'Correção de Gap',
  streak_build: 'Streak',
  skill_develop: 'Desenvolvimento',
  pipeline_improve: 'Pipeline',
  activity_boost: 'Atividade',
};

export function DynamicMissionsCard({ missions, isLoading, onGenerateMissions, isGenerating }: DynamicMissionsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Missões Dinâmicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Missões Dinâmicas
          {missions.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {missions.length} ativa{missions.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        {onGenerateMissions && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onGenerateMissions}
            disabled={isGenerating}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isGenerating && 'animate-spin')} />
            Gerar Novas
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {missions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma missão dinâmica ativa</p>
            {onGenerateMissions && (
              <Button 
                variant="link" 
                className="mt-2" 
                onClick={onGenerateMissions}
                disabled={isGenerating}
              >
                Gerar missões baseadas no seu desempenho
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {missions.map(mission => {
              const Icon = typeIcons[mission.mission_type] || Target;
              const progress = mission.current_value && mission.target_value 
                ? (mission.current_value / mission.target_value) * 100 
                : 0;
              
              return (
                <div 
                  key={mission.id}
                  className={cn(
                    'p-4 rounded-lg border transition-all',
                    mission.is_gap_correction && 'border-orange-500/30 bg-orange-500/5'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded', typeColors[mission.mission_type])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <Badge variant="outline" className={typeColors[mission.mission_type]}>
                          {typeLabels[mission.mission_type]}
                        </Badge>
                        {mission.is_gap_correction && (
                          <Badge variant="outline" className="ml-2 bg-orange-500/10 text-orange-600 border-orange-500/30">
                            +50% XP
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">
                        {mission.xp_weighted || mission.xp_reward} XP
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm font-medium mb-3">{mission.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>
                        {mission.current_value?.toFixed(1) || 0} / {mission.target_value?.toFixed(1) || 0}
                      </span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                  
                  {mission.expires_at && (
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Expira {formatDistanceToNow(new Date(mission.expires_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
