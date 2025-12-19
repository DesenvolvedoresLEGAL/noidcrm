import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, Users, FileText, DollarSign, Target, TrendingUp, Info, Calculator, ArrowDown } from 'lucide-react';
import { useAverageTicket, useWorkingDaysForMonth, useRevenueDistribution } from '@/hooks/useAutoMetrics';
import { useAutoConversionRates } from '@/hooks/useAutoConversionRates';
import { useAutoHeadcount } from '@/hooks/useAutoHeadcount';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import { motion } from 'framer-motion';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

interface FunnelStepProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit?: string;
  color: string;
  delay: number;
}

function FunnelStep({ icon, label, value, unit = '', color, delay }: FunnelStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r ${color} border`}
    >
      <div className="p-2 bg-background/80 rounded-lg">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{Math.ceil(value)}{unit}</div>
      </div>
    </motion.div>
  );
}

export function ReverseFunnelTab() {
  const { config } = useSalesConfig();
  const { averageTicket, isLoading: ticketLoading } = useAverageTicket();
  const { workingDays } = useWorkingDaysForMonth();
  const { distribution, isLoading: distLoading } = useRevenueDistribution();
  const { overall, byChannel } = useAutoConversionRates();
  const { salesTeam, isLoading: headcountLoading } = useAutoHeadcount();
  
  const monthlyGoal = config?.monthly_revenue_target || 0;
  const ticket = averageTicket > 0 ? averageTicket : (config?.average_ticket || 10000);
  const closers = salesTeam > 0 ? salesTeam : (config as any)?.headcount_closer || 1;
  
  // Calculate required sales
  const requiredSales = monthlyGoal > 0 && ticket > 0 ? Math.ceil(monthlyGoal / ticket) : 0;
  
  // Get channel distribution
  const outboundShare = distribution.find(d => d.channel === 'outbound')?.percentage || 23;
  const inboundShare = distribution.find(d => d.channel === 'inbound')?.percentage || 72;
  const referralShare = distribution.find(d => d.channel === 'indicacao')?.percentage || 5;
  
  // Get conversion rates
  const outboundWinRate = byChannel.find(c => c.channel === 'outbound')?.winRate || 54;
  const inboundWinRate = byChannel.find(c => c.channel === 'inbound')?.winRate || 58;
  const referralWinRate = byChannel.find(c => c.channel === 'indicacao')?.winRate || 70;
  
  // Calculate per channel
  const outboundSales = Math.ceil(requiredSales * (outboundShare / 100));
  const inboundSales = Math.ceil(requiredSales * (inboundShare / 100));
  const referralSales = Math.ceil(requiredSales * (referralShare / 100));
  
  // Calculate proposals needed (based on win rate)
  const outboundProposals = outboundWinRate > 0 ? Math.ceil(outboundSales / (outboundWinRate / 100)) : 0;
  const inboundProposals = inboundWinRate > 0 ? Math.ceil(inboundSales / (inboundWinRate / 100)) : 0;
  const referralProposals = referralWinRate > 0 ? Math.ceil(referralSales / (referralWinRate / 100)) : 0;
  
  // Calculate leads/MQLs (assuming 90% MQL to proposal)
  const outboundMQLs = Math.ceil(outboundProposals / 0.9);
  const inboundMQLs = Math.ceil(inboundProposals / 0.9);
  const referralLeads = Math.ceil(referralProposals / 0.9);
  
  // Calculate outbound leads (assuming 79% lead to MQL)
  const outboundLeads = Math.ceil(outboundMQLs / 0.79);
  
  // Calculate calls (assuming 30% call to lead)
  const outboundCalls = Math.ceil(outboundLeads / 0.3);
  
  // Totals
  const totalProposals = outboundProposals + inboundProposals + referralProposals;
  const totalLeads = outboundLeads + inboundMQLs + referralLeads;
  
  // Per seller / per day
  const salesPerSeller = closers > 0 ? requiredSales / closers : 0;
  const proposalsPerSeller = closers > 0 ? totalProposals / closers : 0;
  const salesPerDay = workingDays > 0 ? requiredSales / workingDays : 0;
  const proposalsPerDay = workingDays > 0 ? totalProposals / workingDays : 0;
  
  const isLoading = ticketLoading || distLoading || headcountLoading;
  
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Calculando funil reverso...
      </div>
    );
  }
  
  if (monthlyGoal === 0) {
    return (
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardContent className="py-8 text-center">
          <Target className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Configure a Meta Mensal</h3>
          <p className="text-muted-foreground">
            Defina a meta mensal na aba "Metas" para calcular o funil reverso automaticamente.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                Funil Reverso
                <Badge variant="secondary" className="text-xs font-normal">Automático</Badge>
              </CardTitle>
              <CardDescription>
                Atividades necessárias para atingir a meta de {formatCurrency(monthlyGoal)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-lg bg-background/50">
              <div className="text-2xl font-bold text-primary">{formatCurrency(monthlyGoal)}</div>
              <div className="text-xs text-muted-foreground">Meta Mensal</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50">
              <div className="text-2xl font-bold">{requiredSales}</div>
              <div className="text-xs text-muted-foreground">Vendas Necessárias</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50">
              <div className="text-2xl font-bold">{closers}</div>
              <div className="text-xs text-muted-foreground">Vendedores</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50">
              <div className="text-2xl font-bold">{workingDays}</div>
              <div className="text-xs text-muted-foreground">Dias Úteis</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outbound */}
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center justify-between">
              Outbound
              <Badge variant="outline" className="text-xs">{outboundShare.toFixed(0)}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelStep
              icon={<Phone className="h-4 w-4 text-blue-600" />}
              label="Ligações"
              value={outboundCalls}
              color="from-blue-500/10 to-transparent border-blue-500/20"
              delay={0}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<Users className="h-4 w-4 text-blue-500" />}
              label="Leads"
              value={outboundLeads}
              color="from-blue-500/10 to-transparent border-blue-500/20"
              delay={0.1}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<FileText className="h-4 w-4 text-blue-400" />}
              label="Propostas"
              value={outboundProposals}
              color="from-blue-500/10 to-transparent border-blue-500/20"
              delay={0.2}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<DollarSign className="h-4 w-4 text-blue-600" />}
              label="Vendas"
              value={outboundSales}
              color="from-blue-600/20 to-transparent border-blue-600/30"
              delay={0.3}
            />
          </CardContent>
        </Card>

        {/* Inbound */}
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center justify-between">
              Inbound
              <Badge variant="outline" className="text-xs">{inboundShare.toFixed(0)}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelStep
              icon={<Users className="h-4 w-4 text-emerald-600" />}
              label="Leads/MQLs"
              value={inboundMQLs}
              color="from-emerald-500/10 to-transparent border-emerald-500/20"
              delay={0.1}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<FileText className="h-4 w-4 text-emerald-500" />}
              label="Propostas"
              value={inboundProposals}
              color="from-emerald-500/10 to-transparent border-emerald-500/20"
              delay={0.2}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
              label="Vendas"
              value={inboundSales}
              color="from-emerald-600/20 to-transparent border-emerald-600/30"
              delay={0.3}
            />
          </CardContent>
        </Card>

        {/* Referral */}
        <Card className="border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 flex items-center justify-between">
              Indicação
              <Badge variant="outline" className="text-xs">{referralShare.toFixed(0)}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelStep
              icon={<Users className="h-4 w-4 text-purple-600" />}
              label="Leads"
              value={referralLeads}
              color="from-purple-500/10 to-transparent border-purple-500/20"
              delay={0.1}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<FileText className="h-4 w-4 text-purple-500" />}
              label="Propostas"
              value={referralProposals}
              color="from-purple-500/10 to-transparent border-purple-500/20"
              delay={0.2}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep
              icon={<DollarSign className="h-4 w-4 text-purple-600" />}
              label="Vendas"
              value={referralSales}
              color="from-purple-600/20 to-transparent border-purple-600/30"
              delay={0.3}
            />
          </CardContent>
        </Card>
      </div>

      {/* Per seller breakdown */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Metas por Vendedor</CardTitle>
              <CardDescription>
                Baseado em {closers} vendedores e {workingDays} dias úteis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <div className="text-2xl font-bold">{salesPerSeller.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Vendas/vendedor/mês</div>
            </div>
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <div className="text-2xl font-bold">{proposalsPerSeller.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Propostas/vendedor/mês</div>
            </div>
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <div className="text-2xl font-bold">{salesPerDay.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Vendas/dia (time)</div>
            </div>
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <div className="text-2xl font-bold">{proposalsPerDay.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Propostas/dia (time)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info tooltip */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        Cálculos baseados em ticket médio de {formatCurrency(ticket)}, distribuição por canal dos últimos 6 meses, 
        e taxas de conversão históricas.
      </div>
    </div>
  );
}
