import { ArrowRight, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { PeopleNeedsHelpItem } from '@/hooks/revenue-command/useRevenuePeople';

export function PeopleNeedsHelp({ items }: { items: PeopleNeedsHelpItem[] }) {
  return (
    <RevenueSectionCard
      title="Quem precisa de ajuda"
      description="Sinais que pedem intervenção do gestor agora."
      icon={LifeBuoy}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum sinal de risco individual detectado no período.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {items.map((p) => (
            <Card key={`${p.role}-${p.userId}`} className="border-amber-500/30">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{p.name}</h4>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {p.role}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm">{p.problem}</p>
                <p className="text-xs text-muted-foreground">{p.impact}</p>
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
