import { cn } from '@/lib/utils';
import { Activity, Bot, BookOpen, Database, Share2, LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const iconMap: Record<string, LucideIcon> = {
  Activity,
  Bot,
  BookOpen,
  Database,
  Share2,
};

interface StatusCardProps {
  label: string;
  value: string | number;
  subValue: string;
  status: 'online' | 'degraded' | 'offline' | 'busy';
  icon: string;
  onClick?: () => void;
}

export function StatusCard({
  label,
  value,
  subValue,
  status,
  icon,
  onClick,
}: StatusCardProps) {
  const Icon = iconMap[icon] || Activity;

  const statusColors = {
    online: 'bg-green-500',
    degraded: 'bg-yellow-500',
    offline: 'bg-red-500',
    busy: 'bg-blue-500',
  };

  const statusLabels = {
    online: 'Online',
    degraded: 'Degraded',
    offline: 'Offline',
    busy: 'Busy',
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        'bg-card'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', statusColors[status])} />
            <span className="text-xs text-muted-foreground">
              {statusLabels[status]}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>
        </div>
      </CardContent>
    </Card>
  );
}
