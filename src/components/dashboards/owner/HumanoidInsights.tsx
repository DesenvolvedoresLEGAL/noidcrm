import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lightbulb, TrendingUp, Target, Users } from "lucide-react";

interface HumanoidInsightsProps {
  insights: { insight: string; impact: string; confidence: number }[];
}

const getIcon = (index: number) => {
  const icons = [TrendingUp, Target, Users, Lightbulb, Sparkles];
  const Icon = icons[index % icons.length];
  return Icon;
};

const getIconColor = (index: number) => {
  const colors = ['text-green-500', 'text-blue-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500'];
  return colors[index % colors.length];
};

export function HumanoidInsights({ insights }: HumanoidInsightsProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Insights Críticos do HUMANOID
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Coletando dados para gerar insights...
          </p>
        ) : (
          insights.map((item, i) => {
            const Icon = getIcon(i);
            return (
              <div 
                key={i} 
                className="flex items-start gap-3 p-3 bg-background/80 rounded-lg border border-border/50"
              >
                <div className={`p-2 rounded-lg bg-muted ${getIconColor(i)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.insight}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant={item.impact === 'Alto' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      Impacto {item.impact}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.confidence}% confiança
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
