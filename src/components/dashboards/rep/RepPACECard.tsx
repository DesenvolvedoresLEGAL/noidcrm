import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useRepPACE } from '@/hooks/useRepPACE';
import { Target, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react';
import { formatCurrencyBR } from '@/lib/i18n';
import { motion } from 'framer-motion';

const paceColors = {
  red: 'bg-destructive text-destructive-foreground',
  yellow: 'bg-yellow-500 text-white',
  green: 'bg-emerald-500 text-white',
};

const paceIcons = {
  red: '🔴',
  yellow: '🟡',
  green: '🟢',
};

export function RepPACECard() {
  const { paceData, isLoading, hasTarget } = useRepPACE();

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-8 w-full bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasTarget || !paceData) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Você ainda não tem meta definida para este mês.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fale com seu gestor para configurar suas metas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = Math.min((paceData.achieved / paceData.monthlyTarget) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Meu PACE
            </CardTitle>
            <Badge className={paceColors[paceData.paceScore]}>
              {paceIcons[paceData.paceScore]} {paceData.pacePercentage.toFixed(0)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso do Mês</span>
              <span className="font-medium">
                {formatCurrencyBR(paceData.achieved)} / {formatCurrencyBR(paceData.monthlyTarget)}
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Meta até Hoje"
              value={formatCurrencyBR(paceData.targetUntilToday)}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Realizado"
              value={formatCurrencyBR(paceData.achieved)}
              icon={paceData.paceVariance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              valueColor={paceData.paceVariance >= 0 ? 'text-emerald-600' : 'text-destructive'}
            />
            <MetricCard
              label="Projeção"
              value={formatCurrencyBR(paceData.projection)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Δ PACE"
              value={`${paceData.paceVariance >= 0 ? '+' : ''}${formatCurrencyBR(paceData.paceVariance)}`}
              icon={<Calendar className="h-4 w-4" />}
              valueColor={paceData.paceVariance >= 0 ? 'text-emerald-600' : 'text-destructive'}
            />
          </div>

          {/* Days Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
            <span>
              {paceData.workingDaysPassed} dias úteis passados
            </span>
            <span className="font-medium">
              {paceData.workingDaysRemaining} dias restantes
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon, 
  valueColor = 'text-foreground' 
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
