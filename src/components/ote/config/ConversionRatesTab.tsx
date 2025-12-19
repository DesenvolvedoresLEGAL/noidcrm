import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Info, Sparkles, BarChart3 } from 'lucide-react';
import { useAutoConversionRates } from '@/hooks/useAutoConversionRates';
import { useSalesConfig } from '@/hooks/useSalesConfig';

interface RateDisplayProps {
  label: string;
  value: number;
  count?: string;
  color?: string;
}

function RateDisplay({ label, value, count, color = 'primary' }: RateDisplayProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-semibold cursor-help">{value.toFixed(1)}%</span>
            </TooltipTrigger>
            {count && (
              <TooltipContent>
                <p>{count}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
      <Progress value={value} className="h-2" />
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

interface ConversionRatesTabProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function ConversionRatesTab({ formData, setFormData }: ConversionRatesTabProps) {
  const [useAutoRates, setUseAutoRates] = useState(true);
  const { overall, byChannel, period, isLoading } = useAutoConversionRates();
  
  const outbound = byChannel.find(c => c.channel === 'outbound');
  const inbound = byChannel.find(c => c.channel === 'inbound');
  const indicacao = byChannel.find(c => c.channel === 'indicacao');
  
  // Calculate trend indicator
  const getTrend = (current: number, baseline: number) => {
    const diff = current - baseline;
    if (diff > 2) return { icon: TrendingUp, color: 'text-emerald-500', label: `+${diff.toFixed(0)}%` };
    if (diff < -2) return { icon: TrendingDown, color: 'text-red-500', label: `${diff.toFixed(0)}%` };
    return { icon: Minus, color: 'text-muted-foreground', label: 'Estável' };
  };
  
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Calculando taxas de conversão...
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
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
            {/* Overall Win Rate */}
            <div className="p-4 rounded-lg bg-background/50 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Win Rate Geral</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{overall.winRate.toFixed(1)}%</span>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{overall.totalWon} ganhas / {overall.totalOpportunities} finalizadas</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={overall.winRate} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{overall.totalWon} vendas</span>
                <span>{overall.totalLost} perdas</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Channel Rates */}
      {useAutoRates ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Outbound */}
          <Card className="border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600 flex items-center justify-between">
                Outbound
                <Badge variant="outline" className="text-xs">
                  {outbound?.totalWon || 0} vendas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RateDisplay label="Lead → MQL" value={outbound?.leadToMql || 79} />
              <RateDisplay label="MQL → Proposta" value={outbound?.mqlToProposal || 90} />
              <RateDisplay 
                label="Proposta → Venda" 
                value={outbound?.proposalToSale || 54}
                count={`${outbound?.totalWon || 0}/${outbound?.totalLeads || 0}`}
              />
              <div className="pt-2 border-t">
                <RateDisplay 
                  label="Win Rate" 
                  value={outbound?.winRate || 0}
                />
              </div>
            </CardContent>
          </Card>

          {/* Inbound */}
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600 flex items-center justify-between">
                Inbound
                <Badge variant="outline" className="text-xs">
                  {inbound?.totalWon || 0} vendas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RateDisplay label="Lead → MQL" value={inbound?.leadToMql || 87} />
              <RateDisplay label="MQL → Proposta" value={inbound?.mqlToProposal || 90} />
              <RateDisplay 
                label="Proposta → Venda" 
                value={inbound?.proposalToSale || 58}
                count={`${inbound?.totalWon || 0}/${inbound?.totalLeads || 0}`}
              />
              <div className="pt-2 border-t">
                <RateDisplay 
                  label="Win Rate" 
                  value={inbound?.winRate || 0}
                />
              </div>
            </CardContent>
          </Card>

          {/* Indicação */}
          <Card className="border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600 flex items-center justify-between">
                Indicação
                <Badge variant="outline" className="text-xs">
                  {indicacao?.totalWon || 0} vendas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RateDisplay label="Lead → Proposta" value={indicacao?.mqlToProposal || 90} />
              <RateDisplay 
                label="Proposta → Venda" 
                value={indicacao?.proposalToSale || 70}
                count={`${indicacao?.totalWon || 0}/${indicacao?.totalLeads || 0}`}
              />
              <div className="pt-2 border-t">
                <RateDisplay 
                  label="Win Rate" 
                  value={indicacao?.winRate || 0}
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

      {/* Info */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        {useAutoRates 
          ? 'Taxas calculadas a partir de oportunidades won/lost nos últimos 6 meses. Lead→MQL e MQL→Proposta são estimativas baseadas em benchmarks do setor.'
          : 'Configure as taxas manualmente para sobrescrever os valores automáticos.'}
      </div>
    </div>
  );
}
