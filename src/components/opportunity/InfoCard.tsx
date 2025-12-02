import { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoCardProps {
  title: string;
  icon?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function InfoCard({
  title,
  icon,
  collapsible = false,
  defaultOpen = true,
  children,
  className,
  action,
}: InfoCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader 
        className={cn(
          'pb-3',
          collapsible && 'cursor-pointer hover:bg-muted/50 transition-colors'
        )}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </div>
          <div className="flex items-center gap-1">
            {action}
            {collapsible && (
              <button type="button" className="text-muted-foreground">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-3 text-sm">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
