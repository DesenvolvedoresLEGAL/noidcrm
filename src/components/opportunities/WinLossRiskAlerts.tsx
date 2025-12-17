import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  TrendingUp, 
  Lightbulb, 
  Shield,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface RiskAlert {
  type: 'warning' | 'danger' | 'opportunity';
  title: string;
  description: string;
  pattern: string;
  recommendation: string;
  confidence: number;
}

interface WinLossRiskAlertsProps {
  opportunityId: string;
  organizationId: string;
}

export function WinLossRiskAlerts({ opportunityId, organizationId }: WinLossRiskAlertsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunity-risk', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-opportunity-risk', {
        body: { opportunityId, organizationId }
      });
      
      if (error) throw error;
      return data as { 
        alerts: RiskAlert[]; 
        stats: { totalWins: number; totalLosses: number; winRate: number } 
      };
    },
    enabled: !!opportunityId && !!organizationId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.alerts || data.alerts.length === 0) {
    return null; // Don't show anything if no alerts
  }

  const dangerCount = data.alerts.filter(a => a.type === 'danger').length;
  const warningCount = data.alerts.filter(a => a.type === 'warning').length;
  const opportunityCount = data.alerts.filter(a => a.type === 'opportunity').length;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <Shield className="h-4 w-4 text-amber-500" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getAlertStyle = (type: string) => {
    switch (type) {
      case 'danger': return 'border-red-500/30 bg-red-500/5';
      case 'warning': return 'border-amber-500/30 bg-amber-500/5';
      case 'opportunity': return 'border-emerald-500/30 bg-emerald-500/5';
      default: return 'border-muted';
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-purple-500/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span>Insights Win/Loss</span>
                <div className="flex items-center gap-1 ml-2">
                  {dangerCount > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5">{dangerCount}</Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-600 text-xs px-1.5">{warningCount}</Badge>
                  )}
                  {opportunityCount > 0 && (
                    <Badge className="bg-emerald-500/20 text-emerald-600 text-xs px-1.5">{opportunityCount}</Badge>
                  )}
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {data.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getAlertStyle(alert.type)}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{alert.title}</h4>
                      <Badge variant="outline" className="text-xs opacity-70">
                        {Math.round(alert.confidence * 100)}% confiança
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                    <div className="mt-2 p-2 rounded bg-background/50 border">
                      <p className="text-xs">
                        <span className="font-medium text-foreground">💡 Recomendação:</span>{' '}
                        <span className="text-muted-foreground">{alert.recommendation}</span>
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 opacity-60">
                      Padrão: {alert.pattern}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Stats footer */}
            <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span>Baseado em {data.stats.totalWins + data.stats.totalLosses} deals históricos</span>
              <Badge variant="outline" className="text-xs">
                Win Rate: {data.stats.winRate}%
              </Badge>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
