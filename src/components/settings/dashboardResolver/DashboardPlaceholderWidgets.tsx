import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Widget {
  key?: string;
  label?: string;
  status?: string;
}

export function DashboardPlaceholderWidgets({ widgets }: { widgets: Widget[] }) {
  if (!widgets?.length) {
    return <p className="text-sm text-muted-foreground">Sem widgets configurados.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {widgets.map((w, idx) => (
        <Card key={w.key || idx} className="border-dashed">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{w.label || w.key}</span>
              <Badge variant="outline" className="text-[10px]">
                {w.status || 'placeholder'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{w.key}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
