import { Card, CardContent } from '@/components/ui/card';

interface Props {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}

export function CloserPaceCard({ label, value, hint, highlight }: Props) {
  return (
    <Card className={highlight ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="p-3 space-y-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
