import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle2, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import { CoachInsights } from '@/services/sales-coach/coach';

interface AICoachPanelProps {
  insights: CoachInsights;
}

export function AICoachPanel({ insights }: AICoachPanelProps) {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          AI Sales Coach
          <Badge variant="secondary" className="ml-auto text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Personalizado
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Greeting */}
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <p className="text-sm text-foreground">{insights.greeting}</p>
          <p className="text-xs text-muted-foreground mt-2">{insights.overallAssessment}</p>
        </div>

        {/* Strengths */}
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Pontos Fortes
          </h4>
          <ul className="space-y-1.5">
            {insights.topStrengths.map((strength, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Foque em Melhorar
          </h4>
          <ul className="space-y-1.5">
            {insights.priorityImprovements.map((improvement, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                {improvement}
              </li>
            ))}
          </ul>
        </div>

        {/* Coaching Tips */}
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Dicas do Coach
          </h4>
          <ul className="space-y-1.5">
            {insights.coachingTips.map((tip, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">💡</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Motivational Message */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-primary font-medium">
            ✨ {insights.motivationalMessage}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
