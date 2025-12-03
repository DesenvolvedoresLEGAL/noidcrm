import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle2, Mail, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import { WorkflowExecution } from '@/services/crm/workflow-rules';

interface AutomationImpactKPIsProps {
  executions: WorkflowExecution[];
  rules: any[];
}

export function AutomationImpactKPIs({ executions, rules }: AutomationImpactKPIsProps) {
  // Calculate time saved based on action types
  const calculateTimeSaved = () => {
    const timePerAction: Record<string, number> = {
      create_activity: 2,
      send_email: 3,
      move_stage: 1,
      update_fields: 1,
      notify_user: 0.5,
      duplicate_opportunity: 2,
      close_opportunity: 1,
      move_pipeline: 1,
    };

    let totalMinutes = 0;
    
    rules.forEach(rule => {
      const ruleExecutions = rule.executions_count || 0;
      rule.actions?.forEach((action: any) => {
        totalMinutes += (timePerAction[action.type] || 1) * ruleExecutions;
      });
    });

    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}min`;
    }
    return `${Math.round(totalMinutes)} min`;
  };

  // Count activities auto-created
  const activitiesCreated = rules
    .filter(r => r.actions?.some((a: any) => a.type === 'create_activity'))
    .reduce((acc, r) => acc + (r.executions_count || 0), 0);

  // Count communications sent
  const communicationsSent = rules
    .filter(r => r.actions?.some((a: any) => ['send_email', 'send_whatsapp'].includes(a.type)))
    .reduce((acc, r) => acc + (r.executions_count || 0), 0);

  // Calculate success rate
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter(e => e.status === 'completed').length;
  const failedExecutions = executions.filter(e => e.status === 'failed').length;
  const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 100;

  // Stage progressions
  const stageProgressions = rules
    .filter(r => r.actions?.some((a: any) => ['move_stage', 'move_pipeline'].includes(a.type)))
    .reduce((acc, r) => acc + (r.executions_count || 0), 0);

  const kpis = [
    {
      label: 'Tempo Economizado',
      value: calculateTimeSaved(),
      subtitle: 'esta semana',
      icon: Clock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Atividades Criadas',
      value: activitiesCreated.toString(),
      subtitle: 'automáticas',
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Comunicações',
      value: communicationsSent.toString(),
      subtitle: 'enviadas',
      icon: Mail,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Progressões',
      value: stageProgressions.toString(),
      subtitle: 'de etapa',
      icon: TrendingUp,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      label: 'Taxa de Sucesso',
      value: `${successRate}%`,
      subtitle: `${successfulExecutions}/${totalExecutions}`,
      icon: Zap,
      color: successRate >= 90 ? 'text-green-500' : successRate >= 70 ? 'text-yellow-500' : 'text-destructive',
      bgColor: successRate >= 90 ? 'bg-green-500/10' : successRate >= 70 ? 'bg-yellow-500/10' : 'bg-destructive/10',
    },
    {
      label: 'Falhas Recentes',
      value: failedExecutions.toString(),
      subtitle: 'últimos 7 dias',
      icon: AlertTriangle,
      color: failedExecutions > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: failedExecutions > 0 ? 'bg-destructive/10' : 'bg-muted',
      alert: failedExecutions > 5,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className={`relative overflow-hidden ${kpi.alert ? 'ring-2 ring-destructive/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              {kpi.alert && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xs text-muted-foreground/70">{kpi.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
