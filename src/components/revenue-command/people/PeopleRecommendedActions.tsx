import { ArrowRight, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { PeopleRecommendedAction } from '@/hooks/revenue-command/useRevenuePeople';

const PRIORITY: Record<PeopleRecommendedAction['priority'], string> = {
  alta: 'bg-red-500/10 text-red-600 border-red-500/30',
  média: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  baixa: 'bg-muted text-muted-foreground border-border',
};

export function PeopleRecommendedActions({ actions }: { actions: PeopleRecommendedAction[] }) {
  return (
    <RevenueSectionCard
      title="Ações recomendadas"
      description="Sugestões priorizadas. Nenhuma é executada automaticamente."
      icon={ListChecks}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {actions.map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold">{a.title}</h4>
                <Badge variant="outline" className={cn('shrink-0 text-[10px] capitalize', PRIORITY[a.priority])}>
                  {a.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.reason}</p>
              {a.person && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Pessoa: </span>
                  <span className="font-medium">{a.person.name}</span>{' '}
                  <span className="text-muted-foreground">· {a.person.role}</span>
                </p>
              )}
              <Link
                to={a.cta.to}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {a.cta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </RevenueSectionCard>
  );
}
