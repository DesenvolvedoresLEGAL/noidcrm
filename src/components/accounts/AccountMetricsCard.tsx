import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountMetricsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function AccountMetricsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
}: AccountMetricsCardProps) {
  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className={cn(
            'text-xs mt-1',
            trend === 'up' && 'text-green-600',
            trend === 'down' && 'text-red-600',
            (!trend || trend === 'neutral') && 'text-muted-foreground'
          )}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
