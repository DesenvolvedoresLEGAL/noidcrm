import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function InsightCard({
  title,
  description,
  icon: Icon,
  iconColor = 'text-primary',
  children,
  className,
  headerAction
}: InsightCardProps) {
  return (
    <Card className={cn('animate-fade-in hover:shadow-lg transition-shadow', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={cn('p-2 rounded-lg bg-muted', iconColor)}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
