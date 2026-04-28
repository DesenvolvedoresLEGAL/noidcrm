import type { NormalizedShellWidget } from '@/hooks/dashboard/useDynamicDashboardShell';
import { DynamicWidgetRenderer } from './DynamicWidgetRenderer';

export function DynamicDashboardGrid({ widgets }: { widgets: NormalizedShellWidget[] }) {
  if (!widgets.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum widget placeholder configurado.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {widgets.map((w) => (
        <DynamicWidgetRenderer key={w.key} widget={w} />
      ))}
    </div>
  );
}
