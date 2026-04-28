import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, HelpCircle, AlertCircle } from 'lucide-react';

interface Props {
  withContext: number;
  needsReview: number;
  noContext: number;
  incomplete: number;
}

export function UserContextStatsCards({ withContext, needsReview, noContext, incomplete }: Props) {
  const items = [
    { label: 'Usuários com contexto', value: withContext, Icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Pendentes de revisão', value: needsReview, Icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Sem contexto', value: noContext, Icon: HelpCircle, color: 'text-muted-foreground' },
    { label: 'Incompletos', value: incomplete, Icon: AlertCircle, color: 'text-orange-600' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ label, value, Icon, color }) => (
        <Card key={label}>
          <CardContent className="p-4 flex items-center gap-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <div>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
