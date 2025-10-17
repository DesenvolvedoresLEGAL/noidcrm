import { useEffect, useState } from 'react';
import { GraduationCap, Play, CheckCircle2, Clock } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRecommendedTrainings, Training } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

export function TrainingRecommendations() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecommendedTrainings().then(result => {
      setTrainings(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-500/10 text-green-500 border-green-500/20',
      intermediate: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      advanced: 'bg-red-500/10 text-red-500 border-red-500/20'
    };
    return colors[level] || 'bg-muted text-muted-foreground';
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      beginner: 'Iniciante',
      intermediate: 'Intermediário',
      advanced: 'Avançado'
    };
    return labels[level] || level;
  };

  return (
    <InsightCard
      title="Treinamentos Recomendados"
      description="Aprimore suas habilidades de vendas"
      icon={GraduationCap}
      iconColor="text-blue-500"
    >
      <div className="space-y-3">
        {trainings.map((training, idx) => (
          <div
            key={training.id}
            className={cn(
              'p-4 rounded-lg border transition-all animate-fade-in',
              training.completed
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-card hover:shadow-md'
            )}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {training.completed && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <h4 className="font-semibold text-sm">{training.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {training.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {training.category}
                </Badge>
                <Badge className={getLevelColor(training.level)}>
                  {getLevelLabel(training.level)}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {training.duration} min
                </span>
              </div>

              {!training.completed && (
                <Button size="sm" variant="default">
                  <Play className="h-3 w-3 mr-1" />
                  Iniciar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}
