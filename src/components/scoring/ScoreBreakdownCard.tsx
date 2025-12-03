import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Target, Zap, AlertTriangle, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreBreakdownCardProps {
  type: 'account' | 'opportunity';
  scores: {
    // Account scores
    fit_score?: number;
    intent_score?: number;
    lead_score?: number;
    lead_grade?: string;
    // Opportunity scores
    engagement_score?: number;
    velocity_score?: number;
    risk_score?: number;
    opportunity_score?: number;
    win_probability_ai?: number | null;
    score_confidence?: string;
  };
  factors?: {
    fit?: Record<string, number>;
    intent?: Record<string, number>;
    engagement?: Record<string, number>;
    velocity?: Record<string, number>;
    risk?: Record<string, number>;
  };
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

export function ScoreBreakdownCard({ 
  type, 
  scores, 
  factors = {},
  onRecalculate,
  isRecalculating 
}: ScoreBreakdownCardProps) {
  const getScoreColor = (score: number, inverse = false) => {
    const effectiveScore = inverse ? 100 - score : score;
    if (effectiveScore >= 70) return 'bg-green-500';
    if (effectiveScore >= 50) return 'bg-yellow-500';
    if (effectiveScore >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const renderFactors = (factorObj: Record<string, number> | undefined, positive = true) => {
    if (!factorObj || Object.keys(factorObj).length === 0) return null;
    
    return (
      <div className="mt-2 space-y-1">
        {Object.entries(factorObj).map(([key, value]) => {
          const isPositive = value > 0;
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn(
                'font-medium',
                isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {isPositive ? '+' : ''}{value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (type === 'account') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Lead Score
            </CardTitle>
            {onRecalculate && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRecalculate}
                disabled={isRecalculating}
              >
                <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Score */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg",
                getGradeColor(scores.lead_grade || 'D')
              )}>
                {scores.lead_grade || 'D'}
              </div>
              <div>
                <div className="text-2xl font-bold">{scores.lead_score || 0}</div>
                <div className="text-xs text-muted-foreground">de 100 pontos</div>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="space-y-3">
            {/* FIT Score */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  FIT Score
                </span>
                <span className="text-sm font-bold">{scores.fit_score || 0}</span>
              </div>
              <Progress 
                value={scores.fit_score || 0} 
                className="h-2"
              />
              {renderFactors(factors.fit)}
            </div>

            {/* INTENT Score */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  INTENT Score
                </span>
                <span className="text-sm font-bold">{scores.intent_score || 0}</span>
              </div>
              <Progress 
                value={scores.intent_score || 0} 
                className="h-2"
              />
              {renderFactors(factors.intent)}
            </div>
          </div>

          {/* Formula */}
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Lead Score = (FIT × 40%) + (INTENT × 60%)
          </div>
        </CardContent>
      </Card>
    );
  }

  // Opportunity Score Card
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Opportunity Score
          </CardTitle>
          {onRecalculate && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRecalculate}
              disabled={isRecalculating}
            >
              <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-xl",
              getScoreColor(scores.opportunity_score || 0)
            )}>
              {scores.opportunity_score || 0}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Score Composto</div>
              {scores.win_probability_ai !== null && scores.win_probability_ai !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  <Brain className="h-3 w-3 text-purple-500" />
                  <span className="text-sm font-medium">{scores.win_probability_ai}% prob. de ganho</span>
                  {scores.score_confidence && (
                    <Badge variant="outline" className="text-xs">
                      {scores.score_confidence === 'high' ? 'Alta' : scores.score_confidence === 'medium' ? 'Média' : 'Baixa'} conf.
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3">
          {/* Engagement */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium flex items-center gap-1">
                <Zap className="h-3 w-3 text-blue-500" />
                Engagement
              </span>
              <span className="text-sm font-bold">{scores.engagement_score || 0}</span>
            </div>
            <Progress value={scores.engagement_score || 0} className="h-2" />
            {renderFactors(factors.engagement)}
          </div>

          {/* Velocity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                Velocity
              </span>
              <span className="text-sm font-bold">{scores.velocity_score || 0}</span>
            </div>
            <Progress value={scores.velocity_score || 0} className="h-2" />
            {renderFactors(factors.velocity)}
          </div>

          {/* Risk (inverse display) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                Risk
              </span>
              <span className={cn(
                "text-sm font-bold",
                (scores.risk_score || 0) >= 60 ? "text-red-600" : 
                (scores.risk_score || 0) >= 40 ? "text-yellow-600" : "text-green-600"
              )}>
                {scores.risk_score || 0}
              </span>
            </div>
            <Progress 
              value={scores.risk_score || 0} 
              className={cn(
                "h-2",
                (scores.risk_score || 0) >= 60 ? "[&>div]:bg-red-500" : 
                (scores.risk_score || 0) >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"
              )}
            />
            {renderFactors(factors.risk)}
          </div>
        </div>

        {/* Formula */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Score = (Eng × 30%) + (Vel × 25%) + ((100-Risk) × 25%) + (AI × 20%)
        </div>
      </CardContent>
    </Card>
  );
}
