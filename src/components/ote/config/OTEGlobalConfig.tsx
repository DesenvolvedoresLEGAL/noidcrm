import { useState, useEffect } from 'react';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import { useAverageTicket, useWorkingDaysForMonth, useRevenueDistribution } from '@/hooks/useAutoMetrics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Calendar, Save, Calculator, Target, TrendingUp, CalendarDays, CalendarRange, Info, BarChart3, Sparkles, GitBranch, Percent, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { SalesMetricsDashboard } from './SalesMetricsDashboard';
import { ChannelDistributionChart } from './ChannelDistributionChart';
import { ReverseFunnelTab } from './ReverseFunnelTab';
import { ConversionRatesTab } from './ConversionRatesTab';
import { HeadcountTab } from './HeadcountTab';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

interface GoalCardProps {
  icon: React.ReactNode;
  title: string;
  period: string;
  value: number;
  multiplier: number;
  baseValue: number;
  onChange: (value: number) => void;
  onAutoCalculate: () => void;
  colorClass: string;
}

function GoalCard({ icon, title, period, value, multiplier, baseValue, onChange, onAutoCalculate, colorClass }: GoalCardProps) {
  const suggestedValue = baseValue * multiplier;
  const isAutoCalculated = value === suggestedValue && value > 0;
  
  return (
    <Card className={`relative overflow-hidden border-2 transition-all hover:shadow-md ${colorClass}`}>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
        {icon}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass.replace('border-', 'from-').replace('/30', '/20')} to-transparent`}>
            {icon}
          </div>
          <div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <CardDescription className="text-xs">{period}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Meta (R$)</Label>
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-lg font-semibold"
          />
        </div>
        <div className="flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onAutoCalculate}
                  className="text-xs gap-1"
                >
                  <Calculator className="h-3 w-3" />
                  {multiplier}x mensal
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Calcular: {formatCurrency(baseValue)} × {multiplier} = {formatCurrency(suggestedValue)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isAutoCalculated && (
            <Badge variant="secondary" className="text-xs">
              Auto
            </Badge>
          )}
        </div>
        {value > 0 && (
          <div className="text-xs text-muted-foreground">
            = {formatCurrency(value)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OTEGlobalConfig() {
  const { config, configLoading, upsertConfig } = useSalesConfig();
  
  // Auto-calculated metrics
  const { averageTicket, totalSales, period: ticketPeriod, isLoading: ticketLoading } = useAverageTicket();
  const { workingDays, totalDays, weekends, holidaysCount, holidaysList, month: currentMonth, year } = useWorkingDaysForMonth();
  const { distribution, totalSales: distSales, period: distPeriod, isLoading: distLoading } = useRevenueDistribution();
  
  const [useHistoricalDistribution, setUseHistoricalDistribution] = useState(true);
  
  const [formData, setFormData] = useState({
    monthly_revenue_target: 0,
    quarterly_goal: 0,
    semester_goal: 0,
    yearly_goal: 0,
    average_ticket: 0,
    working_days_per_month: 20,
    headcount_sdr: 0,
    headcount_closer: 0,
    headcount_farmer: 0,
    headcount_cs: 0,
    outbound_call_to_lead: 0.30,
    outbound_lead_to_mql: 0.79,
    outbound_mql_to_proposal: 0.90,
    outbound_proposal_to_sale: 0.54,
    inbound_lead_to_mql: 0.87,
    inbound_mql_to_proposal: 0.90,
    inbound_proposal_to_sale: 0.58,
    referral_request_to_lead: 0.35,
    referral_lead_to_proposal: 0.90,
    referral_proposal_to_sale: 0.70,
    revenue_share_outbound: 0.23,
    revenue_share_inbound: 0.72,
    revenue_share_referral: 0.05,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        monthly_revenue_target: config.monthly_revenue_target || 0,
        quarterly_goal: config.quarterly_goal || 0,
        semester_goal: config.semester_goal || 0,
        yearly_goal: config.yearly_goal || 0,
        average_ticket: config.average_ticket || 0,
        working_days_per_month: config.working_days_per_month || 20,
        headcount_sdr: (config as any).headcount_sdr || 0,
        headcount_closer: (config as any).headcount_closer || 0,
        headcount_farmer: (config as any).headcount_farmer || 0,
        headcount_cs: (config as any).headcount_cs || 0,
        outbound_call_to_lead: config.outbound_call_to_lead || 0.30,
        outbound_lead_to_mql: config.outbound_lead_to_mql || 0.79,
        outbound_mql_to_proposal: config.outbound_mql_to_proposal || 0.90,
        outbound_proposal_to_sale: config.outbound_proposal_to_sale || 0.54,
        inbound_lead_to_mql: config.inbound_lead_to_mql || 0.87,
        inbound_mql_to_proposal: config.inbound_mql_to_proposal || 0.90,
        inbound_proposal_to_sale: config.inbound_proposal_to_sale || 0.58,
        referral_request_to_lead: config.referral_request_to_lead || 0.35,
        referral_lead_to_proposal: config.referral_lead_to_proposal || 0.90,
        referral_proposal_to_sale: config.referral_proposal_to_sale || 0.70,
        revenue_share_outbound: config.revenue_share_outbound || 0.23,
        revenue_share_inbound: config.revenue_share_inbound || 0.72,
        revenue_share_referral: config.revenue_share_referral || 0.05,
      });
    }
  }, [config]);

  const handleSave = async () => {
    const totalShare = formData.revenue_share_outbound + formData.revenue_share_inbound + formData.revenue_share_referral;
    if (Math.abs(totalShare - 1) > 0.01) {
      toast.error('A soma das distribuições de receita deve ser 100%');
      return;
    }
    await upsertConfig(formData);
  };

  const handleAutoCalculateAll = () => {
    const monthly = formData.monthly_revenue_target;
    setFormData(prev => ({
      ...prev,
      quarterly_goal: monthly * 3,
      semester_goal: monthly * 6,
      yearly_goal: monthly * 12,
    }));
    toast.success('Metas calculadas automaticamente');
  };

  if (configLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure metas globais, funil reverso, taxas de conversão e headcount.
        </p>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>

      <Tabs defaultValue="metas">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metas" className="gap-2">
            <Target className="h-4 w-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="funil" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Funil Reverso
          </TabsTrigger>
          <TabsTrigger value="taxas" className="gap-2">
            <Percent className="h-4 w-4" />
            Taxas
          </TabsTrigger>
          <TabsTrigger value="headcount" className="gap-2">
            <Users className="h-4 w-4" />
            Headcount
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="space-y-6 mt-4">
          {/* Seção de Metas por Período */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Metas por Período</CardTitle>
                    <CardDescription>
                      Defina suas metas de receita para cada período. O dashboard do CEO utilizará estas metas.
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleAutoCalculateAll}
                  className="gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  Auto-calcular Todos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <GoalCard
                  icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
                  title="Mensal"
                  period="Base de cálculo"
                  value={formData.monthly_revenue_target}
                  multiplier={1}
                  baseValue={formData.monthly_revenue_target}
                  onChange={(v) => setFormData({ ...formData, monthly_revenue_target: v })}
                  onAutoCalculate={() => {}}
                  colorClass="border-blue-500/30"
                />
                <GoalCard
                  icon={<CalendarRange className="h-5 w-5 text-emerald-600" />}
                  title="Trimestral"
                  period="3 meses"
                  value={formData.quarterly_goal}
                  multiplier={3}
                  baseValue={formData.monthly_revenue_target}
                  onChange={(v) => setFormData({ ...formData, quarterly_goal: v })}
                  onAutoCalculate={() => setFormData({ ...formData, quarterly_goal: formData.monthly_revenue_target * 3 })}
                  colorClass="border-emerald-500/30"
                />
                <GoalCard
                  icon={<Calendar className="h-5 w-5 text-amber-600" />}
                  title="Semestral"
                  period="6 meses"
                  value={formData.semester_goal}
                  multiplier={6}
                  baseValue={formData.monthly_revenue_target}
                  onChange={(v) => setFormData({ ...formData, semester_goal: v })}
                  onAutoCalculate={() => setFormData({ ...formData, semester_goal: formData.monthly_revenue_target * 6 })}
                  colorClass="border-amber-500/30"
                />
                <GoalCard
                  icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
                  title="Anual"
                  period="12 meses"
                  value={formData.yearly_goal}
                  multiplier={12}
                  baseValue={formData.monthly_revenue_target}
                  onChange={(v) => setFormData({ ...formData, yearly_goal: v })}
                  onAutoCalculate={() => setFormData({ ...formData, yearly_goal: formData.monthly_revenue_target * 12 })}
                  colorClass="border-purple-500/30"
                />
              </div>
            </CardContent>
          </Card>

          {/* Métricas Calculadas Automaticamente */}
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Métricas Calculadas
                    <Badge variant="secondary" className="text-xs font-normal">Automático</Badge>
                  </CardTitle>
                  <CardDescription>
                    Valores calculados automaticamente com base nos dados reais do sistema
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ticket Médio */}
                <Card className="bg-background/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          Ticket Médio
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {ticketLoading ? (
                            <span className="text-muted-foreground">Calculando...</span>
                          ) : (
                            formatCurrency(averageTicket)
                          )}
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Calculado automaticamente a partir de {totalSales} vendas nos {ticketPeriod}.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Baseado em {totalSales} vendas ({ticketPeriod})
                    </div>
                  </CardContent>
                </Card>

                {/* Dias Úteis */}
                <Card className="bg-background/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          Dias Úteis ({currentMonth}/{year})
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {workingDays} dias
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                              <p>{totalDays} dias totais - {weekends} fins de semana - {holidaysCount} feriados</p>
                              {holidaysList.length > 0 && (
                                <p className="text-xs">Feriados: {holidaysList.join(', ')}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {totalDays} - {weekends} FDS - {holidaysCount} feriados
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribuição por Canal */}
              <Card className="bg-background/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">Distribuição por Canal ({distPeriod})</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="use-historical" className="text-xs text-muted-foreground cursor-pointer">
                        Usar histórico
                      </Label>
                      <input
                        id="use-historical"
                        type="checkbox"
                        checked={useHistoricalDistribution}
                        onChange={(e) => setUseHistoricalDistribution(e.target.checked)}
                        className="rounded border-border"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {distLoading ? (
                    <div className="text-sm text-muted-foreground">Calculando distribuição...</div>
                  ) : distribution.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem dados de vendas para calcular distribuição</div>
                  ) : useHistoricalDistribution ? (
                    <div className="space-y-3">
                      {distribution.map((item) => (
                        <div key={item.channel} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.label}</span>
                            <span className="text-muted-foreground">
                              {item.percentage.toFixed(1)}% ({item.count} vendas)
                            </span>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                        </div>
                      ))}
                      <div className="pt-2 text-xs text-muted-foreground border-t">
                        Total: {distSales} vendas nos {distPeriod}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs">Outbound (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.revenue_share_outbound * 100}
                          onChange={(e) => setFormData({ ...formData, revenue_share_outbound: (parseFloat(e.target.value) || 0) / 100 })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Inbound (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.revenue_share_inbound * 100}
                          onChange={(e) => setFormData({ ...formData, revenue_share_inbound: (parseFloat(e.target.value) || 0) / 100 })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Indicação (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.revenue_share_referral * 100}
                          onChange={(e) => setFormData({ ...formData, revenue_share_referral: (parseFloat(e.target.value) || 0) / 100 })}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-3 text-xs text-muted-foreground">
                        A soma deve ser 100%
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Dashboard de Métricas Consolidado */}
          <SalesMetricsDashboard />

          {/* Gráfico de Distribuição por Canal */}
          <ChannelDistributionChart />
        </TabsContent>

        <TabsContent value="funil" className="mt-4">
          <ReverseFunnelTab />
        </TabsContent>

        <TabsContent value="taxas" className="mt-4">
          <ConversionRatesTab formData={formData} setFormData={setFormData} />
        </TabsContent>

        <TabsContent value="headcount" className="mt-4">
          <HeadcountTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
