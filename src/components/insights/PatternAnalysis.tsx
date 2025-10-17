import { useEffect, useState } from 'react';
import { Sparkles, Clock, Users, Zap, TrendingDown, AlertCircle } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Badge } from '@/components/ui/badge';
import { getPatternAnalysis, Pattern } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function PatternAnalysis() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatternAnalysis().then(result => {
      setPatterns(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      Clock,
      Users,
      Zap,
      TrendingDown,
      AlertCircle
    };
    return icons[iconName] || Sparkles;
  };

  const getImpactColor = (impact: string) => {
    const colors: Record<string, string> = {
      high: 'bg-green-500/10 text-green-500 border-green-500/20',
      medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      low: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    };
    return colors[impact] || 'bg-muted text-muted-foreground';
  };

  const getImpactLabel = (impact: string) => {
    const labels: Record<string, string> = {
      high: 'Alto Impacto',
      medium: 'Médio Impacto',
      low: 'Baixo Impacto'
    };
    return labels[impact] || impact;
  };

  return (
    <InsightCard
      title="Padrões Detectados pela IA"
      description="Insights baseados no seu histórico de vendas"
      icon={Sparkles}
      iconColor="text-purple-500"
    >
      <div className="space-y-3">
        {patterns.map((pattern, idx) => {
          const Icon = getIcon(pattern.icon);
          
          return (
            <div
              key={pattern.id}
              className="p-4 rounded-lg border bg-card hover:shadow-md transition-all animate-fade-in"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Icon className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium flex-1">{pattern.insight}</p>
                    <Badge className={getImpactColor(pattern.impact)}>
                      {getImpactLabel(pattern.impact)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}
