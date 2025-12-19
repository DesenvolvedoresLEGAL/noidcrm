import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Minus, Info, Sparkles, AlertTriangle, Bell, Check, X, ArrowUp, ArrowDown } from 'lucide-react';
import { useAutoConversionRates, TrendData } from '@/hooks/useAutoConversionRates';
import { useConversionBenchmarks, useConversionAlerts, useCheckConversionAlerts } from '@/hooks/useConversionAlerts';
import { motion, AnimatePresence } from 'framer-motion';

interface TrendIndicatorProps {
  trend: TrendData;
  label?: string;
}

function TrendIndicator({ trend, label }: TrendIndicatorProps) {
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const colorClass = trend.isImproving 
    ? 'text-emerald-500' 
    : trend.direction === 'down' 
      ? 'text-red-500' 
      : 'text-muted-foreground';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${colorClass}`}>
            <Icon className="h-4 w-4" />
            {trend.change !== 0 && (
              <span className="text-xs font-medium">
                {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p>{label || 'Tendência'}: {trend.direction === 'up' ? 'Subindo' : trend.direction === 'down' ? 'Caindo' : 'Estável'}</p>
            <p>Atual: {trend.current.toFixed(1)}% | Anterior: {trend.previous.toFixed(1)}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RateDisplayProps {
  label: string;
  value: number;
  count?: string;
  trend?: TrendData;
  threshold?: number;
}

function RateDisplay({ label, value, count, trend, threshold }: RateDisplayProps) {
  const isBelowThreshold = threshold !== undefined && value < threshold && value > 0;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {trend && <TrendIndicator trend={trend} label={label} />}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`font-semibold cursor-help ${isBelowThreshold ? 'text-red-500' : ''}`}>
                  {value.toFixed(1)}%
                </span>
              </TooltipTrigger>
              {count && (
                <TooltipContent>
                  <p>{count}</p>
                  {isBelowThreshold && <p className="text-red-400">Abaixo do benchmark de {threshold}%</p>}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="relative">
        <Progress value={value} className="h-2" />
        {threshold !== undefined && (
          <div 
            className="absolute top-0 h-2 w-0.5 bg-amber-500"
            style={{ left: `${Math.min(threshold, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

interface ManualRateInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function ManualRateInput({ label, value, onChange }: ManualRateInputProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={(value * 100).toFixed(0)}
          onChange={(e) => onChange((parseFloat(e.target.value) || 0) / 100)}
          className="text-sm h-8"
        />
        <span className="text-muted-foreground text-sm">%</span>
      </div>
    </div>
  );
}

function AlertsPanel() {
  const { alerts, isLoading, acknowledgeAlert, resolveAlert } = useConversionAlerts();
  
  if (isLoading || !alerts?.length) return null;
  
  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      win_rate: 'Win Rate',
      proposal_to_sale: 'Proposta → Venda',
      lead_to_mql: 'Lead → MQL',
      mql_to_proposal: 'MQL → Proposta',
    };
    return labels[metric] || metric;
  };
  
  const getChannelLabel = (channel: string) => {
    const labels: Record<string, string> = {
      overall: 'Geral',
      outbound: 'Outbound',
      inbound: 'Inbound',
      indicacao: 'Indicação',
    };
    return labels[channel] || channel;
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-500/10';
      case 'warning': return 'border-amber-500 bg-amber-500/10';
      default: return 'border-blue-500 bg-blue-500/10';
    }
  };
  
  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Alertas de Conversão</CardTitle>
          <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getChannelLabel(alert.channel)}
                    </Badge>
                    <span className="text-sm font-medium">{getMetricLabel(alert.metric)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Atual: <span className="text-red-500 font-medium">{alert.current_value.toFixed(1)}%</span>
                    {' '}| Benchmark: {alert.threshold_value.toFixed(1)}%
                    {alert.trend_direction && (
                      <span className="ml-2">
                        {alert.trend_direction === 'down' ? (
                          <ArrowDown className="inline h-3 w-3 text-red-500" />
                        ) : alert.trend_direction === 'up' ? (
                          <ArrowUp className="inline h-3 w-3 text-emerald-500" />
                        ) : null}
                        {alert.trend_percentage && ` ${alert.trend_percentage.toFixed(1)}%`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reconhecer</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => resolveAlert(alert.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Resolver</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

interface ConversionRatesTabProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function ConversionRatesTab({ formData, setFormData }: ConversionRatesTabProps) {
  const [useAutoRates, setUseAutoRates] = useState(true);
  const { overall, byChannel, trends, period, isLoading } = useAutoConversionRates();
  const { benchmarks } = useConversionBenchmarks();
  const { checkAndCreateAlerts } = useCheckConversionAlerts();
  
  const outbound = byChannel.find(c => c.channel === 'outbound');
  const inbound = byChannel.find(c => c.channel === 'inbound');
  const indicacao = byChannel.find(c => c.channel === 'indicacao');
  
  const outboundTrend = trends.byChannel.find(c => c.channel === 'outbound');
  const inboundTrend = trends.byChannel.find(c => c.channel === 'inbound');
  const indicacaoTrend = trends.byChannel.find(c => c.channel === 'indicacao');
  
  // Get benchmark for a specific channel/metric
  const getBenchmark = (channel: string, metric: string) => {
    const benchmark = benchmarks?.find(b => b.channel === channel && b.metric === metric && b.is_active);
    return benchmark?.min_threshold;
  };
  
  // Check alerts when rates change
  useEffect(() => {
    if (!isLoading && overall.totalOpportunities > 0) {
      checkAndCreateAlerts({ overall, byChannel, trends });
    }
  }, [isLoading, overall.winRate]);
  
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Calculando taxas de conversão...
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Alerts Panel */}
      <AlertsPanel />
      
      {/* Header with toggle */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Taxas de Conversão
                  <Badge variant="secondary" className="text-xs font-normal">
                    {useAutoRates ? 'Automático' : 'Manual'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {useAutoRates 
                    ? `Calculadas automaticamente dos ${period}`
                    : 'Valores configurados manualmente'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="use-auto-rates" className="text-sm text-muted-foreground">
                Usar automático
              </Label>
              <Switch
                id="use-auto-rates"
                checked={useAutoRates}
                onCheckedChange={setUseAutoRates}
              />
            </div>
          </div>
        </CardHeader>
        
        {useAutoRates && (
          <CardContent>
            {/* Overall Win Rate with Trend */}
            <div className="p-4 rounded-lg bg-background/50 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Win Rate Geral</span>
                <div className="flex items-center gap-3">
                  <TrendIndicator trend={trends.overall} label="Win Rate Geral" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-bold ${
                            getBenchmark('overall', 'win_rate') && overall.winRate < getBenchmark('overall', 'win_rate')! 
                              ? 'text-red-500' 
                              : ''
                          }`}>
                            {overall.winRate.toFixed(1)}%
                          </span>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{overall.totalWon} ganhas / {overall.totalOpportunities} finalizadas</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Período anterior: {trends.overall.previous.toFixed(1)}%
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="relative">
                <Progress value={overall.winRate} className="h-3" />
                {getBenchmark('overall', 'win_rate') && (
                  <div 
                    className="absolute top-0 h-3 w-0.5 bg-amber-500"
                    style={{ left: `${Math.min(getBenchmark('overall', 'win_rate')!, 100)}%` }}
                    title={`Benchmark: ${getBenchmark('overall', 'win_rate')}%`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{overall.totalWon} vendas</span>
                <div className="flex items-center gap-2">
                  {trends.overall.direction === 'up' ? (
                    <span className="text-emerald-500">↑ Melhorando vs período anterior</span>
                  ) : trends.overall.direction === 'down' ? (
                    <span className="text-red-500">↓ Piorando vs período anterior</span>
                  ) : (
                    <span>Estável vs período anterior</span>
                  )}
                </div>
                <span>{overall.totalLost} perdas</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Channel Rates with Trends */}
      {useAutoRates ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Outbound */}
          <Card className="border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600 flex items-center justify-between">
                <span>Outbound</span>
                <div className="flex items-center gap-2">
                  {outboundTrend && <TrendIndicator trend={outboundTrend.winRate} />}
                  <Badge variant="outline" className="text-xs">
                    {outbound?.totalWon || 0} vendas
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RateDisplay label="Lead → MQL" value={outbound?.leadToMql || 79} />
              <RateDisplay label="MQL → Proposta" value={outbound?.mqlToProposal || 90} />
              <RateDisplay 
                label="Proposta → Venda" 
                value={outbound?.proposalToSale || 54}
                count={`${outbound?.totalWon || 0}/${outbound?.totalLeads || 0}`}
                trend={outboundTrend?.proposalToSale}
                threshold={getBenchmark('outbound', 'proposal_to_sale')}
              />
              <div className="pt-2 border-t">
                <RateDisplay 
                  label="Win Rate" 
                  value={outbound?.winRate || 0}
                  trend={outboundTrend?.winRate}
                  threshold={getBenchmark('outbound', 'win_rate')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Inbound */}
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600 flex items-center justify-between">
                <span>Inbound</span>
                <div className="flex items-center gap-2">
                  {inboundTrend && <TrendIndicator trend={inboundTrend.winRate} />}
                  <Badge variant="outline" className="text-xs">
                    {inbound?.totalWon || 0} vendas
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RateDisplay label="Lead → MQL" value={inbound?.leadToMql || 87} />
              <RateDisplay label="MQL → Proposta" value={inbound?.mqlToProposal || 90} />
              <RateDisplay 
                label="Proposta → Venda" 
                value={inbound?.proposalToSale || 58}
                count={`${inbound?.totalWon || 0}/${inbound?.totalLeads || 0}`}
                trend={inboundTrend?.proposalToSale}
                threshold={getBenchmark('inbound', 'proposal_to_sale')}
              />
              <div className="pt-2 border-t">
                <RateDisplay 
                  label="Win Rate" 
                  value={inbound?.winRate || 0}
                  trend={inboundTrend?.winRate}
                  threshold={getBenchmark('inbound', 'win_rate')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Indicação */}
          <Card className="border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600 flex items-center justify-between">
                <span>Indicação</span>
                <div className="flex items-center gap-2">
                  {indicacaoTrend && <TrendIndicator trend={indicacaoTrend.winRate} />}
                  <Badge variant="outline" className="text-xs">
                    {indicacao?.totalWon || 0} vendas
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RateDisplay label="Lead → Proposta" value={indicacao?.mqlToProposal || 90} />
              <RateDisplay 
                label="Proposta → Venda" 
                value={indicacao?.proposalToSale || 70}
                count={`${indicacao?.totalWon || 0}/${indicacao?.totalLeads || 0}`}
                trend={indicacaoTrend?.proposalToSale}
                threshold={getBenchmark('indicacao', 'proposal_to_sale')}
              />
              <div className="pt-2 border-t">
                <RateDisplay 
                  label="Win Rate" 
                  value={indicacao?.winRate || 0}
                  trend={indicacaoTrend?.winRate}
                  threshold={getBenchmark('indicacao', 'win_rate')}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Manual Rate Inputs */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-blue-600">Outbound</CardTitle>
              <CardDescription>Prospecção ativa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ManualRateInput 
                label="Ligação → Lead" 
                value={formData.outbound_call_to_lead} 
                onChange={(v) => setFormData({ ...formData, outbound_call_to_lead: v })} 
              />
              <ManualRateInput 
                label="Lead → MQL" 
                value={formData.outbound_lead_to_mql} 
                onChange={(v) => setFormData({ ...formData, outbound_lead_to_mql: v })} 
              />
              <ManualRateInput 
                label="MQL → Proposta" 
                value={formData.outbound_mql_to_proposal} 
                onChange={(v) => setFormData({ ...formData, outbound_mql_to_proposal: v })} 
              />
              <ManualRateInput 
                label="Proposta → Venda" 
                value={formData.outbound_proposal_to_sale} 
                onChange={(v) => setFormData({ ...formData, outbound_proposal_to_sale: v })} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-emerald-600">Inbound</CardTitle>
              <CardDescription>Leads orgânicos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ManualRateInput 
                label="Lead → MQL" 
                value={formData.inbound_lead_to_mql} 
                onChange={(v) => setFormData({ ...formData, inbound_lead_to_mql: v })} 
              />
              <ManualRateInput 
                label="MQL → Proposta" 
                value={formData.inbound_mql_to_proposal} 
                onChange={(v) => setFormData({ ...formData, inbound_mql_to_proposal: v })} 
              />
              <ManualRateInput 
                label="Proposta → Venda" 
                value={formData.inbound_proposal_to_sale} 
                onChange={(v) => setFormData({ ...formData, inbound_proposal_to_sale: v })} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-purple-600">Indicação</CardTitle>
              <CardDescription>Referrals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ManualRateInput 
                label="Pedido → Lead" 
                value={formData.referral_request_to_lead} 
                onChange={(v) => setFormData({ ...formData, referral_request_to_lead: v })} 
              />
              <ManualRateInput 
                label="Lead → Proposta" 
                value={formData.referral_lead_to_proposal} 
                onChange={(v) => setFormData({ ...formData, referral_lead_to_proposal: v })} 
              />
              <ManualRateInput 
                label="Proposta → Venda" 
                value={formData.referral_proposal_to_sale} 
                onChange={(v) => setFormData({ ...formData, referral_proposal_to_sale: v })} 
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Melhorando</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span>Piorando</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-muted-foreground" />
            <span>Estável</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-0.5 h-3 bg-amber-500" />
            <span>Benchmark mínimo</span>
          </div>
        </div>
        <p>
          <Info className="h-3 w-3 inline mr-1" />
          {useAutoRates 
            ? 'Comparação: últimos 3 meses vs 3-6 meses anteriores. Alertas são gerados quando as taxas ficam abaixo dos benchmarks.'
            : 'Configure as taxas manualmente para sobrescrever os valores automáticos.'}
        </p>
      </div>
    </div>
  );
}
