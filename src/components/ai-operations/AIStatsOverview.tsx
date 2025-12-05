import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Edit,
  TrendingUp,
  Bell,
  AlertTriangle,
  Bot,
} from 'lucide-react';
import { useAIActionStats, useAIAlertStats } from '@/hooks/useAISupervision';

export function AIStatsOverview() {
  const { data: actionStats, isLoading: actionsLoading } = useAIActionStats();
  const { data: alertStats, isLoading: alertsLoading } = useAIAlertStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Ações IA (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="text-2xl font-bold">{actionStats?.total24h || 0}</div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {actionStats?.autoExecuted || 0} auto
                </Badge>
                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600">
                  <Zap className="h-3 w-3 mr-1" />
                  {actionStats?.executedNotified || 0} notif
                </Badge>
                <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600">
                  <Clock className="h-3 w-3 mr-1" />
                  {actionStats?.awaitingApproval || 0} pend
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Taxa de Sucesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{actionStats?.successRate || 0}%</span>
                <span className="text-sm text-muted-foreground">das decisões</span>
              </div>
              <Progress value={actionStats?.successRate || 0} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
                  {actionStats?.approved || 0} aprovadas
                </span>
                <span>
                  <XCircle className="h-3 w-3 inline mr-1 text-red-500" />
                  {actionStats?.rejected || 0} rejeitadas
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Confiança Média
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{actionStats?.avgConfidence || 0}%</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  &gt;90%: Auto-executa
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  70-90%: Executa + Notifica
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  &lt;70%: Pede aprovação
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-500" />
            Alertas Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="text-2xl font-bold">{alertStats?.activeAlerts || 0}</div>
              <div className="flex flex-wrap gap-1">
                {(alertStats?.criticalAlerts || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {alertStats?.criticalAlerts} críticos
                  </Badge>
                )}
                {(alertStats?.highAlerts || 0) > 0 && (
                  <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600">
                    {alertStats?.highAlerts} altos
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {alertStats?.acknowledgedToday || 0} hoje
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Human Corrections */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Edit className="h-4 w-4 text-purple-500" />
            Correções Humanas (Feedback para ML)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionsLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-center gap-8">
              <div className="space-y-1">
                <div className="text-xl font-bold">{actionStats?.overridden || 0}</div>
                <p className="text-xs text-muted-foreground">decisões corrigidas</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-muted/50 text-sm">
                <p className="text-muted-foreground">
                  Quando você corrige uma decisão da IA, este feedback é registrado para futuro 
                  treinamento do modelo. Quanto mais correções, melhor a IA se tornará.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
