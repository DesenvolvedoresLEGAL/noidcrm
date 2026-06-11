import { ArrowRight, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { PeopleTopPerformer } from '@/hooks/revenue-command/useRevenuePeople';

export function PeopleTopPerformers({ items }: { items: PeopleTopPerformer[] }) {
  return (
    <RevenueSectionCard
      title="Quem está carregando"
      description="Pessoas com maior contribuição no período."
      icon={Trophy}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem pessoas com contribuição relevante no período.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {items.map((p) => (
            <Card key={`${p.role}-${p.userId}`} className="border-emerald-500/30">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{p.name}</h4>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {p.role}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm font-medium">{p.primaryMetric}</p>
                <p className="text-xs text-muted-foreground">{p.contribution}</p>
                <Link
                  to={p.cta.to}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {p.cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </RevenueSectionCard>
  );
}
