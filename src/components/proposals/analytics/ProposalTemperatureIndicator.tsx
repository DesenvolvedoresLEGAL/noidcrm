import { Flame, Sun, Snowflake, ThermometerSun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProposalTemperature = 'hot' | 'warm' | 'cold' | 'frozen';

interface ProposalTemperatureIndicatorProps {
  temperature: ProposalTemperature;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const temperatureConfig: Record<ProposalTemperature, {
  label: string;
  icon: typeof Flame;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  hot: {
    label: 'Quente',
    icon: Flame,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    description: 'Alta probabilidade de fechamento',
  },
  warm: {
    label: 'Morno',
    icon: Sun,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Interesse moderado detectado',
  },
  cold: {
    label: 'Frio',
    icon: ThermometerSun,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    description: 'Baixa interação recente',
  },
  frozen: {
    label: 'Congelado',
    icon: Snowflake,
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    borderColor: 'border-slate-400/30',
    description: 'Sem atividade detectada',
  },
};

const sizeConfig = {
  sm: { icon: 'h-3 w-3', padding: 'p-1.5', text: 'text-xs' },
  md: { icon: 'h-4 w-4', padding: 'p-2', text: 'text-sm' },
  lg: { icon: 'h-5 w-5', padding: 'p-2.5', text: 'text-base' },
};

export function ProposalTemperatureIndicator({
  temperature,
  showLabel = true,
  size = 'md',
  className,
}: ProposalTemperatureIndicatorProps) {
  const config = temperatureConfig[temperature];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border transition-all',
        config.bgColor,
        config.borderColor,
        sizes.padding,
        className
      )}
      title={config.description}
    >
      <Icon className={cn(sizes.icon, config.color)} />
      {showLabel && (
        <span className={cn('font-semibold pr-1', sizes.text, config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

export function getProposalTemperature(
  engagementScore: number,
  daysSinceLastView: number | null
): ProposalTemperature {
  // No views = frozen
  if (daysSinceLastView === null) return 'frozen';
  
  // Recent high engagement = hot
  if (engagementScore >= 70 && daysSinceLastView <= 3) return 'hot';
  
  // Good engagement or recent activity = warm
  if (engagementScore >= 40 || daysSinceLastView <= 7) return 'warm';
  
  // Low engagement and older = cold
  if (daysSinceLastView <= 14) return 'cold';
  
  // Very old = frozen
  return 'frozen';
}
