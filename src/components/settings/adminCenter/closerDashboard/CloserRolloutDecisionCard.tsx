import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CloserRolloutDecision } from '@/services/crm/closerDashboardObservability';

interface Props {
  decision?: CloserRolloutDecision;
}

const label: Record<string, string> = {
  ready: 'Pronto',
  attention: 'Atenção',
  hold: 'Não expandir ainda',
};
const variant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ready: 'default',
  attention: 'secondary',
  hold: 'destructive',
};

export function CloserRolloutDecisionCard({ decision }: Props) {
  if (!decision) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pronto para expandir?</CardTitle>
        <CardDescription>Decisão baseada em uso, estabilidade, performance e feedback.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={variant[decision.status]}>{label[decision.status]}</Badge>
        <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
          {decision.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
