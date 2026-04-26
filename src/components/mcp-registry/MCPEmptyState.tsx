import { Card, CardContent } from '@/components/ui/card';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function MCPEmptyState({ title, description, icon: Icon = Inbox, action, className }: Props) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
