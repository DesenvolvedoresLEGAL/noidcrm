import { useState } from 'react';
import { useReverseFunnel } from '@/hooks/usePACEData';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, Phone, Users, Target, FileText, DollarSign, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
};

interface FunnelStepProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

function FunnelStep({ label, value, icon, color, delay = 0 }: FunnelStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`flex items-center gap-3 p-3 rounded-lg ${color}`}
    >
      <div className="p-2 rounded-full bg-background/50">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </motion.div>
  );
}

export function ReverseFunnelCalculator() {
  const { config } = useSalesConfig();
  const { calculateReverseFunnel } = useReverseFunnel();
  const [targetRevenue, setTargetRevenue] = useState(config?.monthly_revenue_target || 100000);
  
  const funnel = calculateReverseFunnel(targetRevenue);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Funil Reverso
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Target Input */}
        <div className="mb-6">
          <Label>Meta de Receita Mensal</Label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">R$</span>
            <Input
              type="number"
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(parseFloat(e.target.value) || 0)}
              className="max-w-xs"
            />
          </div>
        </div>

        {/* Revenue Distribution */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-blue-500/10 text-center">
            <p className="text-xs text-muted-foreground">Outbound</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(funnel.outbound.revenue)}</p>
            <Badge variant="outline" className="mt-1">{(config?.revenue_share_outbound || 0.23) * 100}%</Badge>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 text-center">
            <p className="text-xs text-muted-foreground">Inbound</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(funnel.inbound.revenue)}</p>
            <Badge variant="outline" className="mt-1">{(config?.revenue_share_inbound || 0.72) * 100}%</Badge>
          </div>
          <div className="p-4 rounded-lg bg-purple-500/10 text-center">
            <p className="text-xs text-muted-foreground">Indicação</p>
            <p className="text-lg font-bold text-purple-600">{formatCurrency(funnel.referral.revenue)}</p>
            <Badge variant="outline" className="mt-1">{(config?.revenue_share_referral || 0.05) * 100}%</Badge>
          </div>
        </div>

        {/* Funnel Visualization */}
        <div className="grid grid-cols-3 gap-6">
          {/* Outbound Funnel */}
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Outbound
            </h4>
            <FunnelStep 
              label="Ligações" 
              value={funnel.outbound.calls} 
              icon={<Phone className="h-4 w-4" />}
              color="bg-blue-500/10"
              delay={0}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Leads" 
              value={funnel.outbound.leads} 
              icon={<Users className="h-4 w-4" />}
              color="bg-blue-500/15"
              delay={0.1}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="MQLs" 
              value={funnel.outbound.mqls} 
              icon={<Target className="h-4 w-4" />}
              color="bg-blue-500/20"
              delay={0.2}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Propostas" 
              value={funnel.outbound.proposals} 
              icon={<FileText className="h-4 w-4" />}
              color="bg-blue-500/25"
              delay={0.3}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Vendas" 
              value={funnel.outbound.sales} 
              icon={<DollarSign className="h-4 w-4" />}
              color="bg-blue-500/30"
              delay={0.4}
            />
          </div>

          {/* Inbound Funnel */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-600 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Inbound
            </h4>
            <FunnelStep 
              label="Leads" 
              value={funnel.inbound.leads} 
              icon={<Users className="h-4 w-4" />}
              color="bg-green-500/10"
              delay={0}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="MQLs" 
              value={funnel.inbound.mqls} 
              icon={<Target className="h-4 w-4" />}
              color="bg-green-500/15"
              delay={0.1}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Propostas" 
              value={funnel.inbound.proposals} 
              icon={<FileText className="h-4 w-4" />}
              color="bg-green-500/20"
              delay={0.2}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Vendas" 
              value={funnel.inbound.sales} 
              icon={<DollarSign className="h-4 w-4" />}
              color="bg-green-500/25"
              delay={0.3}
            />
          </div>

          {/* Referral Funnel */}
          <div className="space-y-2">
            <h4 className="font-semibold text-purple-600 mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Indicação
            </h4>
            <FunnelStep 
              label="Pedidos" 
              value={funnel.referral.requests} 
              icon={<Users className="h-4 w-4" />}
              color="bg-purple-500/10"
              delay={0}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Leads" 
              value={funnel.referral.leads} 
              icon={<Users className="h-4 w-4" />}
              color="bg-purple-500/15"
              delay={0.1}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Propostas" 
              value={funnel.referral.proposals} 
              icon={<FileText className="h-4 w-4" />}
              color="bg-purple-500/20"
              delay={0.2}
            />
            <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            <FunnelStep 
              label="Vendas" 
              value={funnel.referral.sales} 
              icon={<DollarSign className="h-4 w-4" />}
              color="bg-purple-500/25"
              delay={0.3}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="mt-6 p-4 rounded-lg bg-primary/10">
          <h4 className="font-semibold mb-3">Totais Necessários (Mensal)</h4>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{funnel.total.leads}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{funnel.total.mqls}</p>
              <p className="text-xs text-muted-foreground">MQLs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{funnel.total.proposals}</p>
              <p className="text-xs text-muted-foreground">Propostas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{funnel.total.sales}</p>
              <p className="text-xs text-muted-foreground">Vendas</p>
            </div>
          </div>
        </div>

        {/* Conversion Rates Info */}
        {!config && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            💡 Configure as taxas de conversão em Configurações → Configurações de Vendas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
