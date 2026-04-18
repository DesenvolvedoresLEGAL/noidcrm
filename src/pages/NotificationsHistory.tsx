import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Filter, CheckCheck, X } from 'lucide-react';
import {
  useNotificationsHistory,
  exportToCsv,
  DEFAULT_FILTERS,
  type HistoryFilters,
  type HistoryStatus,
  type HistoryPeriod,
} from '@/hooks/useNotificationsHistory';
import type { InboxItem, InboxCategory, InboxPriority, InboxSource } from '@/hooks/useUnifiedInbox';
import { NotificationsHeader } from '@/components/notifications/history/NotificationsHeader';
import { NotificationsFilters } from '@/components/notifications/history/NotificationsFilters';
import { NotificationsTimeline } from '@/components/notifications/history/NotificationsTimeline';
import { NotificationDetailPanel } from '@/components/notifications/history/NotificationDetailPanel';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

function parseUrlFilters(params: URLSearchParams): HistoryFilters {
  const get = (key: string) => params.get(key);
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? null;

  return {
    search: get('q') ?? '',
    period: (get('period') as HistoryPeriod) ?? '7d',
    customStart: get('start') ?? undefined,
    customEnd: get('end') ?? undefined,
    status: (list('status') as HistoryStatus[]) ?? DEFAULT_FILTERS.status,
    categories: (list('cat') as InboxCategory[]) ?? DEFAULT_FILTERS.categories,
    priorities: (list('prio') as InboxPriority[]) ?? DEFAULT_FILTERS.priorities,
    sources: (list('src') as InboxSource[]) ?? DEFAULT_FILTERS.sources,
  };
}

function buildUrl(filters: HistoryFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search) p.set('q', filters.search);
  if (filters.period !== '7d') p.set('period', filters.period);
  if (filters.customStart) p.set('start', filters.customStart);
  if (filters.customEnd) p.set('end', filters.customEnd);
  if (filters.status.length !== DEFAULT_FILTERS.status.length) {
    p.set('status', filters.status.join(','));
  }
  if (filters.categories.length !== DEFAULT_FILTERS.categories.length) {
    p.set('cat', filters.categories.join(','));
  }
  if (filters.priorities.length !== DEFAULT_FILTERS.priorities.length) {
    p.set('prio', filters.priorities.join(','));
  }
  if (filters.sources.length !== DEFAULT_FILTERS.sources.length) {
    p.set('src', filters.sources.join(','));
  }
  return p;
}

export default function NotificationsHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<HistoryFilters>(() => parseUrlFilters(searchParams));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 300);
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  useEffect(() => {
    const next = buildUrl(filters);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const {
    items,
    allItems,
    kpis,
    unreadGlobal,
    isLoading,
    markRead,
    dismiss,
    snooze,
    bulkMarkRead,
    bulkDismiss,
    markAllReadGlobal,
    isMarkingAllRead,
  } = useNotificationsHistory(effectiveFilters);

  const handleMarkAllReadGlobal = async () => {
    try {
      const res = await markAllReadGlobal();
      const total = (res?.v2 ?? 0) + (res?.v1 ?? 0);
      if (total > 0) {
        toast.success(
          `${total} notificações marcadas como lidas em todas as visualizações`,
        );
      } else {
        toast.success('Tudo limpo — nenhuma notificação pendente');
      }
    } catch (e) {
      toast.error('Falha ao marcar todas como lidas');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (ids: string[]) => setSelectedIds(new Set(ids));
  const handleClearSelection = () => setSelectedIds(new Set());

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  const handleBulkRead = () => {
    if (!selectedItems.length) return;
    bulkMarkRead(selectedItems);
    toast.success(`${selectedItems.length} marcada(s) como lida(s)`);
    handleClearSelection();
  };

  const handleBulkDismiss = () => {
    if (!selectedItems.length) return;
    bulkDismiss(selectedItems);
    toast.success(`${selectedItems.length} dispensada(s)`);
    handleClearSelection();
  };

  const handleExport = () => {
    if (items.length === 0) {
      toast.error('Nada para exportar com os filtros atuais');
      return;
    }
    exportToCsv(items);
    toast.success(`${items.length} notificações exportadas`);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === '/') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder^="Título"]');
        input?.focus();
      } else if (e.key === 'Escape') {
        setActiveItemId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Always derive active item from the live list so reads/dismisses reflect immediately
  const activeItem = useMemo(
    () => allItems.find((i) => i.id === activeItemId) ?? null,
    [allItems, activeItemId],
  );

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero header + KPIs */}
        <NotificationsHeader
          total={kpis.total}
          critical={kpis.critical}
          today={kpis.today}
          trendPct={kpis.trendPct}
          trendCurrent={kpis.trendCurrent}
          unreadGlobal={unreadGlobal}
          isMarkingAllRead={isMarkingAllRead}
          onExport={handleExport}
          onMarkAllReadGlobal={handleMarkAllReadGlobal}
          onOpenMobileFilters={() => setMobileFiltersOpen(true)}
        />

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <Card className="bg-primary/5 border-primary/30 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-medium">
              {selectedIds.size} {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkRead} className="gap-1.5">
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar lidas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDismiss}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Dispensar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearSelection}>
                Cancelar
              </Button>
            </div>
          </Card>
        )}

        {/* Body — 2 column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 md:gap-6">
          {/* Desktop filters */}
          <aside className="hidden lg:block">
            <Card className="sticky top-4 overflow-hidden h-[calc(100vh-8rem)]">
              <NotificationsFilters
                filters={filters}
                onChange={setFilters}
                totalShown={items.length}
                totalAll={allItems.length}
              />
            </Card>
          </aside>

          {/* Mobile filters sheet */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetContent side="left" className="w-[300px] p-0">
              <NotificationsFilters
                filters={filters}
                onChange={setFilters}
                totalShown={items.length}
                totalAll={allItems.length}
              />
            </SheetContent>
          </Sheet>

          {/* Timeline */}
          <Card className="overflow-hidden flex flex-col min-h-[60vh] lg:h-[calc(100vh-8rem)]">
            {/* Mobile filters trigger */}
            <div className="lg:hidden border-b px-4 py-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <Filter className="h-3.5 w-3.5" />
                Filtros
              </Button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <NotificationsTimeline
                items={items}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
                onRowClick={(item) => {
                  setActiveItemId(item.id);
                  if (!item.read_at) markRead(item);
                }}
                activeId={activeItem?.id}
              />
            )}
          </Card>
        </div>

        {/* Detail panel */}
        <NotificationDetailPanel
          item={activeItem}
          open={!!activeItem}
          onClose={() => setActiveItemId(null)}
          onMarkRead={markRead}
          onDismiss={dismiss}
          onSnooze={(item, hours) => snooze({ item, hours })}
        />
      </div>
    </Layout>
  );
}
