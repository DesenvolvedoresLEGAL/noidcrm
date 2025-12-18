import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ForecastOpportunity } from '@/hooks/useForecastData';
import { AlertTriangle, CheckCircle2, XCircle, Info, TrendingUp, Calendar, Percent, Activity, User, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForecastDataQualityProps {
  opportunities: ForecastOpportunity[];
  goal: number;
}

interface QualityMetric {
  label: string;
  description: string;
  value: number;
  total: number;
  percentage: number;
  status: 'good' | 'warning' | 'critical';
  icon: React.ElementType;
}

export function ForecastDataQuality({ opportunities, goal }: ForecastDataQualityProps) {
  const total = opportunities.length;

  // Calculate quality metrics
  const withProbability = opportunities.filter(o => o.prob > 0).length;
  const withCloseDate = opportunities.filter(o => o.close_date_prevista).length;
  const withRecentActivity = opportunities.filter(o => o.days_since_activity < 7).length;
  const withValue = opportunities.filter(o => o.valor_previsto > 0).length;
  const withContact = opportunities.filter(o => o.has_contact).length;
  const withNextStep = opportunities.filter(o => o.has_next_step).length;
  const lowRisk = opportunities.filter(o => o.risk_level === 'low' || o.risk_level === 'medium').length;

  const getStatus = (percentage: number): 'good' | 'warning' | 'critical' => {
    if (percentage >= 80) return 'good';
    if (percentage >= 50) return 'warning';
    return 'critical';
  };

  const metrics: QualityMetric[] = [
    {
      label: 'Com Probabilidade',
      description: 'Oportunidades com probabilidade de fechamento definida',
      value: withProbability,
      total,
      percentage: total > 0 ? (withProbability / total) * 100 : 0,
      status: getStatus(total > 0 ? (withProbability / total) * 100 : 0),
      icon: Percent,
    },
    {
      label: 'Com Data de Fechamento',
      description: 'Oportunidades com previsão de fechamento definida',
      value: withCloseDate,
      total,
      percentage: total > 0 ? (withCloseDate / total) * 100 : 0,
      status: getStatus(total > 0 ? (withCloseDate / total) * 100 : 0),
      icon: Calendar,
    },
    {
      label: 'Atividade Recente',
      description: 'Oportunidades com atividade nos últimos 7 dias',
      value: withRecentActivity,
      total,
      percentage: total > 0 ? (withRecentActivity / total) * 100 : 0,
      status: getStatus(total > 0 ? (withRecentActivity / total) * 100 : 0),
      icon: Activity,
    },
    {
      label: 'Com Valor Definido',
      description: 'Oportunidades com valor previsto maior que zero',
      value: withValue,
      total,
      percentage: total > 0 ? (withValue / total) * 100 : 0,
      status: getStatus(total > 0 ? (withValue / total) * 100 : 0),
      icon: TrendingUp,
    },
    {
      label: 'Com Contato Identificado',
      description: 'Oportunidades com contato principal definido',
      value: withContact,
      total,
      percentage: total > 0 ? (withContact / total) * 100 : 0,
      status: getStatus(total > 0 ? (withContact / total) * 100 : 0),
      icon: User,
    },
    {
      label: 'Com Próximo Passo',
      description: 'Oportunidades com atividade pendente/agendada',
      value: withNextStep,
      total,
      percentage: total > 0 ? (withNextStep / total) * 100 : 0,
      status: getStatus(total > 0 ? (withNextStep / total) * 100 : 0),
      icon: ListChecks,
    },
  ];

  // Calculate overall quality score
  const overallScore = metrics.reduce((sum, m) => sum + m.percentage, 0) / metrics.length;
  const overallStatus = getStatus(overallScore);

  // Calculate confidence rating
  const confidenceFactors = {
    dataCompleteness: overallScore / 100,
    historicalData: goal > 0 ? 0.8 : 0.3, // If goal is set, assume some history
    pipelineHealth: total > 0 ? lowRisk / total : 0,
    goalCoverage: goal > 0 && total > 0 
      ? Math.min(opportunities.reduce((sum, o) => sum + o.valor_previsto, 0) / goal, 1)
      : 0,
  };

  const confidenceScore = (
    confidenceFactors.dataCompleteness * 0.4 +
    confidenceFactors.historicalData * 0.2 +
    confidenceFactors.pipelineHealth * 0.2 +
    confidenceFactors.goalCoverage * 0.2
  ) * 100;

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return { label: 'Alta', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    if (score >= 60) return { label: 'Moderada', color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    if (score >= 40) return { label: 'Baixa', color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
    return { label: 'Muito Baixa', color: 'text-red-500', bgColor: 'bg-red-500/10' };
  };

  const confidence = getConfidenceLabel(confidenceScore);

  const statusConfig = {
    good: { color: 'text-emerald-500', bgColor: 'bg-emerald-500', icon: CheckCircle2 },
    warning: { color: 'text-amber-500', bgColor: 'bg-amber-500', icon: AlertTriangle },
    critical: { color: 'text-red-500', bgColor: 'bg-red-500', icon: XCircle },
  };

  if (total === 0) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Qualidade dos Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma oportunidade no pipeline para análise</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-transparent">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Confiabilidade do Forecast
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge className={cn('font-bold', confidence.bgColor, confidence.color)}>
                  {confidenceScore.toFixed(0)}% - {confidence.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">
                  Score de confiabilidade baseado na completude dos dados, 
                  saúde do pipeline e cobertura da meta.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Overall Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'p-4 rounded-lg border',
            overallStatus === 'good' && 'bg-emerald-500/5 border-emerald-500/20',
            overallStatus === 'warning' && 'bg-amber-500/5 border-amber-500/20',
            overallStatus === 'critical' && 'bg-red-500/5 border-red-500/20',
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Qualidade Geral dos Dados</span>
            <span className={cn('text-2xl font-bold', statusConfig[overallStatus].color)}>
              {overallScore.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={overallScore} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {overallStatus === 'good' && 'Dados do pipeline estão completos e confiáveis para previsões.'}
            {overallStatus === 'warning' && 'Alguns dados estão incompletos. Melhore para previsões mais precisas.'}
            {overallStatus === 'critical' && 'Dados insuficientes. Preencha informações das oportunidades.'}
          </p>
        </motion.div>

        {/* Individual Metrics */}
        <div className="space-y-3">
          {metrics.map((metric, index) => {
            const StatusIcon = statusConfig[metric.status].icon;
            const MetricIcon = metric.icon;
            
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-2 cursor-help">
                        <MetricIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{metric.label}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">{metric.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {metric.value}/{metric.total}
                    </span>
                    <StatusIcon className={cn('h-4 w-4', statusConfig[metric.status].color)} />
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.percentage}%` }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                    className={cn('h-full rounded-full', statusConfig[metric.status].bgColor)}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recommendations */}
        {overallStatus !== 'good' && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recomendações:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {metrics.filter(m => m.status !== 'good').slice(0, 3).map(m => (
                <li key={m.label} className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>
                    {m.label === 'Com Probabilidade' && 'Defina probabilidades de fechamento para melhorar previsões'}
                    {m.label === 'Com Data de Fechamento' && 'Adicione datas previstas de fechamento nas oportunidades'}
                    {m.label === 'Atividade Recente' && 'Atualize oportunidades paradas há mais de 7 dias'}
                    {m.label === 'Com Valor Definido' && 'Preencha valores previstos nas oportunidades'}
                    {m.label === 'Com Contato Identificado' && 'Vincule contatos principais às oportunidades'}
                    {m.label === 'Com Próximo Passo' && 'Crie atividades de follow-up para oportunidades sem próximo passo'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
