import { cn } from '@/lib/utils';

interface ScoreProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  colorMode?: 'default' | 'inverse';
  className?: string;
}

export function ScoreProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  size = 'md',
  colorMode = 'default',
  className,
}: ScoreProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const getColor = () => {
    const score = colorMode === 'inverse' ? 100 - percentage : percentage;
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const heightStyles = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
          {label && <span className="font-medium">{label}</span>}
          {showValue && <span className="tabular-nums">{Math.round(value)}</span>}
        </div>
      )}
      <div className={cn('w-full bg-muted/50 rounded-full overflow-hidden', heightStyles[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
