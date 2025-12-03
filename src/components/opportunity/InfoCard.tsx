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
    <Card className={cn('shadow-sm border-border/50', className)}>
      <CardHeader 
        className={cn(
          'py-2 px-2.5',
          collapsible && 'cursor-pointer hover:bg-muted/50 transition-colors'
        )}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <CardTitle className="text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </div>
          <div className="flex items-center gap-0.5">
            {action}
            {collapsible && (
              <button type="button" className="text-muted-foreground">
                {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-2 text-xs px-2.5 pb-2.5 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
