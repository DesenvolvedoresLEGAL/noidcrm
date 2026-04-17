import { useMemo } from 'react';
import type { InboxItem, InboxPriority } from '@/hooks/useUnifiedInbox';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  MessageSquare,
  Megaphone,
  Inbox as InboxIcon,
  ExternalLink,
} from 'lucide-react';
import { format, isToday, isYesterday, startOfWeek, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  items: InboxItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onRowClick: (item: InboxItem) => void;
  activeId?: string | null;
}

const PRIORITY_DOT: Record<InboxPriority, string> = {
  critical: 'bg-destructive',
  high: 'bg-orange-500',
  medium: 'bg-primary',
  low: 'bg-muted-foreground/40',
};

function categoryIcon(category: string) {
  switch (category) {
    case 'activities':
      return CalendarDays;
    case 'proposals':
      return FileText;
    case 'conversations':
      return MessageSquare;
    case 'news':
      return Megaphone;
    default:
      return AlertTriangle;
  }
}

interface Group {
  key: string;
  label: string;
  items: InboxItem[];
}

function groupByDay(items: InboxItem[]): Group[] {
  const todayItems: InboxItem[] = [];
  const yesterdayItems: InboxItem[] = [];
  const weekItems: InboxItem[] = [];
  const olderByMonth = new Map<string, InboxItem[]>();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  for (const i of items) {
    const d = new Date(i.created_at);
    if (isToday(d)) {
      todayItems.push(i);
    } else if (isYesterday(d)) {
      yesterdayItems.push(i);
    } else if (isAfter(d, weekStart)) {
      weekItems.push(i);
    } else {
      const monthKey = format(d, 'MMMM yyyy', { locale: ptBR });
      if (!olderByMonth.has(monthKey)) olderByMonth.set(monthKey, []);
      olderByMonth.get(monthKey)!.push(i);
    }
  }

  const groups: Group[] = [];
  if (todayItems.length) groups.push({ key: 'today', label: 'Hoje', items: todayItems });
  if (yesterdayItems.length) groups.push({ key: 'yesterday', label: 'Ontem', items: yesterdayItems });
  if (weekItems.length) groups.push({ key: 'week', label: 'Esta semana', items: weekItems });
  for (const [month, list] of olderByMonth) {
    groups.push({ key: month, label: month.charAt(0).toUpperCase() + month.slice(1), items: list });
  }
  return groups;
}

export function NotificationsTimeline({
  items,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onRowClick,
  activeId,
}: Props) {
  const groups = useMemo(() => groupByDay(items), [items]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center max-w-sm">
          <InboxIcon className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-base font-semibold mb-1">Nenhuma notificação</h3>
          <p className="text-sm text-muted-foreground">
            Nenhum item corresponde aos filtros atuais. Ajuste os filtros ou aguarde novos eventos.
          </p>
        </div>
      </div>
    );
  }

  const allVisibleIds = items.map((i) => i.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-muted/20">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(v) => (v ? onSelectAll(allVisibleIds) : onClearSelection())}
          aria-label="Selecionar todas"
        />
        <span className="text-xs text-muted-foreground">
          {selectedIds.size > 0
            ? `${selectedIds.size} selecionada${selectedIds.size > 1 ? 's' : ''}`
            : `${items.length} notificações`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <ul className="divide-y divide-border">
              {group.items.map((item) => {
                const Icon = categoryIcon(item.category);
                const isUnread = !item.read_at;
                const isSelected = selectedIds.has(item.id);
                const isActive = activeId === item.id;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'group px-4 py-3 transition-colors cursor-pointer flex items-start gap-3',
                      isUnread && 'bg-primary/[0.02]',
                      isActive && 'bg-primary/10',
                      !isActive && 'hover:bg-muted/40',
                    )}
                    onClick={() => onRowClick(item)}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(item.id)}
                        aria-label="Selecionar"
                      />
                    </div>

                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[item.priority])}
                      aria-label={`Prioridade ${item.priority}`}
                    />

                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={cn(
                            'text-sm truncate',
                            isUnread ? 'font-semibold' : 'font-normal text-foreground/80',
                          )}
                        >
                          {item.title}
                        </span>
                        {item.source === 'release_note' && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/40 text-primary">
                            Novidade
                          </Badge>
                        )}
                        {item.priority === 'critical' && (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                            Crítico
                          </Badge>
                        )}
                        {item.dismissed_at && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                            Dispensada
                          </Badge>
                        )}
                        {item.snoozed_until && new Date(item.snoozed_until) > new Date() && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                            Adiada
                          </Badge>
                        )}
                      </div>
                      {item.message && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.message}</p>
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground shrink-0 flex flex-col items-end gap-1">
                      <time dateTime={item.created_at}>
                        {format(new Date(item.created_at), 'HH:mm')}
                      </time>
                      {item.action_url && (
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
