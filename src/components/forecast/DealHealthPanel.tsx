import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useHealthDrivers, useCalculateHealthDrivers, HealthDriver } from '@/hooks/useHealthDrivers';
import { Activity, Zap, Users, TrendingUp, RefreshCw, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealHealthPanelProps {
  opportunityId: string;
  healthScore?: number;
}

const categoryConfig = {
  engagement: { icon: Activity, label: 'Engajamento', color: 'text-blue-500' },
  velocity: { icon: Zap, label: 'Velocidade', color: 'text-yellow-500' },
  relationship: { icon: Users, label: 'Relacionamento', color: 'text-purple-500' },
  behavior: { icon: TrendingUp, label: 'Comportamento', color: 'text-green-500' },
};

export function DealHealthPanel({ opportunityId, healthScore = 50 }: DealHealthPanelProps) {
  const { data: drivers, isLoading } = useHealthDrivers(opportunityId);
  const calculateMutation = useCalculateHealthDrivers();

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const positiveDrivers = drivers?.filter(d => d.impact_direction === 'positive') || [];
  const negativeDrivers = drivers?.filter(d => d.impact_direction === 'negative') || [];
  const criticalDrivers = drivers?.filter(d => d.remediation_priority === 'critical') || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Deal Health</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => calculateMutation.mutate(opportunityId)}
          disabled={calculateMutation.isPending}
        >
          <RefreshCw className={cn("h-4 w-4", calculateMutation.isPending && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score Circle */}
        <div className="flex items-center justify-center">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
              <circle
                cx="48" cy="48" r="40"
                stroke="currentColor" strokeWidth="8" fill="none"
                strokeDasharray={`${healthScore * 2.51} 251`}
                className={getScoreColor(healthScore)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-2xl font-bold", getScoreColor(healthScore))}>{healthScore}</span>
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        {criticalDrivers.length > 0 && (
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2 text-red-500 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              {criticalDrivers.length} Alerta(s) Crítico(s)
            </div>
            {criticalDrivers.slice(0, 2).map((driver) => (
              <p key={driver.id} className="text-sm text-muted-foreground">{driver.evidence_description}</p>
            ))}
          </div>
        )}

        {/* Drivers Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              {positiveDrivers.length} Positivos
            </div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              {negativeDrivers.length} Riscos
            </div>
          </div>
        </div>

        {/* Top Drivers */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Principais Fatores</h4>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : drivers?.slice(0, 4).map((driver) => (
            <DriverItem key={driver.id} driver={driver} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DriverItem({ driver }: { driver: HealthDriver }) {
  const config = categoryConfig[driver.driver_category];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
      <Icon className={cn("h-4 w-4 mt-0.5", config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{driver.evidence_description}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={driver.impact_direction === 'positive' ? 'default' : 'destructive'} className="text-xs">
            {driver.impact_score > 0 ? '+' : ''}{driver.impact_score}
          </Badge>
          <span className="text-xs text-muted-foreground">{config.label}</span>
        </div>
      </div>
      {driver.suggested_playbook_id && (
        <Button variant="ghost" size="sm" className="shrink-0">
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default DealHealthPanel;
