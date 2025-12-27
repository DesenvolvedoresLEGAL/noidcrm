import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadScoreBySegmentProps {
  segmentStats: Array<{
    segment: string;
    count: number;
    averageScore: number;
  }>;
  isLoading: boolean;
}

export function LeadScoreBySegment({ segmentStats, isLoading }: LeadScoreBySegmentProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-500/10';
    if (score >= 50) return 'text-yellow-600 bg-yellow-500/10';
    return 'text-red-600 bg-red-500/10';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Lead Score por Segmento
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Mostra a média do Lead Score por segmento de mercado. Útil para identificar quais segmentos têm leads mais qualificados.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {segmentStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum segmento definido nos leads
          </div>
        ) : (
          <div className="space-y-3">
            {segmentStats.map((stat, index) => (
              <div 
                key={stat.segment}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-muted-foreground w-6">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{stat.segment}</div>
                    <div className="text-xs text-muted-foreground">{stat.count} leads</div>
                  </div>
                </div>
                <Badge className={cn("font-mono font-bold", getScoreColor(stat.averageScore))}>
                  Score: {stat.averageScore}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
