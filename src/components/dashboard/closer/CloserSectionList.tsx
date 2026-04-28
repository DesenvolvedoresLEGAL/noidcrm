import { Card, CardContent } from '@/components/ui/card';
import { CloserListItemRow } from './CloserListItemRow';
import type { CloserListItem } from '@/types/dashboard/closer';

interface Props {
  title: string;
  description?: string;
  items: CloserListItem[];
  emptyText?: string;
  showValue?: boolean;
}

export function CloserSectionList({ title, description, items, emptyText, showValue }: Props) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyText ?? 'Nada por aqui.'}</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <CloserListItemRow key={`${it.kind}-${it.id}`} item={it} showValue={showValue} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
