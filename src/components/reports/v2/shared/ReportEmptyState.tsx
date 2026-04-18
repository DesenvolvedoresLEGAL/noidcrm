/**
 * Sprint 2.7 — Estado vazio padrão.
 */
import { Inbox, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export function ReportEmptyState({ icon: Icon = Inbox, title, description }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="h-10 w-10 text-muted-foreground/60" />
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
