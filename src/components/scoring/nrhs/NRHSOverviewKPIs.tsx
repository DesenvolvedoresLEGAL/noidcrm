// NRHS Overview KPIs - Header com KPIs globais

import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Skull, DollarSign } from 'lucide-react';
import { NRHSKPIs } from '@/services/crm/nrhs-analytics';
import { NRHSTier } from '@/services/crm/nrhs-calculator';

interface NRHSOverviewKPIsProps {
  kpis: NRHSKPIs;
  isLoading: boolean;
  onFilterTier: (tier: NRHSTier | 'at_risk_or_below') => void;
}

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  tooltip: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'yellow' | 'orange' | 'red' | 'destructive';
  onClick?: () => void;
  isLoading?: boolean;
}

function KPICard({ label, value, subtext, tooltip, icon, color, onClick, isLoading }: KPICardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const iconColorClasses = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-500',
    yellow: 'text-yellow-500',
    orange: 'text-orange-500',
    red: 'text-red-500',
    destructive: 'text-destructive',
  };

  if (isLoading) {
    return (
      <Card className="border bg-card">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={`border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${onClick ? 'hover:shadow-md' : ''}`}
            onClick={onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <span className={iconColorClasses[color]}>{icon}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{value}</span>
                {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function NRHSOverviewKPIs({ kpis, isLoading, onFilterTier }: NRHSOverviewKPIsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const healthyPercent = kpis.totalDeals > 0 
    ? Math.round(((kpis.eliteCount + kpis.healthyCount) / kpis.totalDeals) * 100) 
    : 0;

  const riskPercent = kpis.totalDeals > 0 
    ? Math.round((kpis.riskCount / kpis.totalDeals) * 100) 
    : 0;

  const criticalPercent = kpis.totalDeals > 0 
    ? Math.round((kpis.criticalCount / kpis.totalDeals) * 100) 
    : 0;

  const insalubriousPercent = kpis.totalDeals > 0 
    ? Math.round((kpis.insalubriousCount / kpis.totalDeals) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        label="NRHS Médio"
        value={kpis.averageScore}
        subtext="/ 100"
        tooltip="Score médio de higiene de receita de todos os deals ativos. Quanto maior, mais confiável é seu pipeline."
        icon={<Shield className="h-4 w-4" />}
        color={kpis.averageScore >= 75 ? 'emerald' : kpis.averageScore >= 60 ? 'yellow' : 'red'}
        isLoading={isLoading}
      />
      
      <KPICard
        label="Saudáveis"
        value={`${healthyPercent}%`}
        subtext={`(${kpis.eliteCount + kpis.healthyCount})`}
        tooltip="Percentual de deals com NRHS igual ou superior a 75. Esses deals têm dados confiáveis para forecast."
        icon={<CheckCircle2 className="h-4 w-4" />}
        color="emerald"
        onClick={() => onFilterTier('healthy')}
        isLoading={isLoading}
      />
      
      <KPICard
        label="Em Risco"
        value={`${riskPercent}%`}
        subtext={`(${kpis.riskCount})`}
        tooltip="Deals com NRHS entre 60 e 74. Precisam de atenção para melhorar a qualidade dos dados."
        icon={<AlertTriangle className="h-4 w-4" />}
        color="yellow"
        onClick={() => onFilterTier('risk')}
        isLoading={isLoading}
      />
      
      <KPICard
        label="Críticos"
        value={`${criticalPercent}%`}
        subtext={`(${kpis.criticalCount})`}
        tooltip="Deals com NRHS entre 40 e 59. Dados incompletos podem comprometer a previsibilidade."
        icon={<XCircle className="h-4 w-4" />}
        color="orange"
        onClick={() => onFilterTier('critical')}
        isLoading={isLoading}
      />
      
      <KPICard
        label="Insalubres"
        value={`${insalubriousPercent}%`}
        subtext={`(${kpis.insalubriousCount})`}
        tooltip="Deals com NRHS abaixo de 40. Pipeline inflado ou dados operacionais muito incompletos."
        icon={<Skull className="h-4 w-4" />}
        color="red"
        onClick={() => onFilterTier('insalubrious')}
        isLoading={isLoading}
      />
      
      <KPICard
        label="Valor em Risco"
        value={formatCurrency(kpis.valueAtRisk)}
        tooltip="Valor total do pipeline em deals com NRHS abaixo de 60. Esses valores têm baixa confiabilidade no forecast."
        icon={<DollarSign className="h-4 w-4" />}
        color="destructive"
        onClick={() => onFilterTier('at_risk_or_below')}
        isLoading={isLoading}
      />
    </div>
  );
}
