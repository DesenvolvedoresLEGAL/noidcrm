import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { InboxItem, InboxPriority, InboxCategory, InboxSource } from '@/hooks/useUnifiedInbox';
import { normalizeInboxItems } from '@/lib/notifications/normalizeInboxItems';

export type HistoryStatus = 'unread' | 'read' | 'dismissed' | 'snoozed';
export type HistoryPeriod = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';

export interface HistoryFilters {
  search: string;
  period: HistoryPeriod;
  customStart?: string;
  customEnd?: string;
  status: HistoryStatus[];
  categories: InboxCategory[];
  priorities: InboxPriority[];
  sources: InboxSource[];
}

export const DEFAULT_FILTERS: HistoryFilters = {
  search: '',
  period: '7d',
  status: ['unread', 'read'],
  categories: ['priority', 'activities', 'proposals', 'conversations', 'news'],
  priorities: ['critical', 'high', 'medium', 'low'],
  sources: ['v2', 'v1', 'release_note'],
};

const READ_NEWS_KEY = 'read_news_ids';

function periodToDate(period: HistoryPeriod, customStart?: string): Date | null {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === '7d') return new Date(now.getTime() - 7 * 86400000);
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000);
  if (period === '90d') return new Date(now.getTime() - 90 * 86400000);
  if (period === 'custom' && customStart) return new Date(customStart);
  return null;
}

function getReadNewsIds(): string[] {
  try {
    const stored = localStorage.getItem(READ_NEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useNotificationsHistory(filters: HistoryFilters) {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [readNewsIds, setReadNewsIds] = useState<string[]>(getReadNewsIds);

  const fromDate = useMemo(
    () => periodToDate(filters.period, filters.customStart),
    [filters.period, filters.customStart],
  );
  const toDate = useMemo(
    () => (filters.period === 'custom' && filters.customEnd ? new Date(filters.customEnd) : null),
    [filters.period, filters.customEnd],
  );

  const v2Query = useQuery({
    queryKey: ['notif-history', 'v2', userId, fromDate?.toISOString(), toDate?.toISOString()],
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase
        .from('notifications_v2')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (fromDate) q = q.gte('created_at', fromDate.toISOString());
      if (toDate) q = q.lte('created_at', toDate.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

  const v1Query = useQuery({
    queryKey: ['notif-history', 'v1', userId, fromDate?.toISOString(), toDate?.toISOString()],
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (fromDate) q = q.gte('created_at', fromDate.toISOString());
      if (toDate) q = q.lte('created_at', toDate.toISOString());
      const { data, error } = await q;
      if (error) {
        console.warn('[notif-history] legacy fetch failed', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  });

  const newsQuery = useQuery({
    queryKey: ['notif-history', 'release-notes', fromDate?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from('release_notes')
        .select('id, version, title, description, release_date, is_major, changes')
        .order('release_date', { ascending: false })
        .limit(50);
      if (fromDate) q = q.gte('release_date', fromDate.toISOString());
      const { data, error } = await q;
      if (error) {
        console.warn('[notif-history] release notes fetch failed', error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Global unread count (ignores period filter) — true source of truth for "unread backlog"
  const unreadGlobalQuery = useQuery({
    queryKey: ['notif-history', 'unread-global', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('notifications_v2')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .is('dismissed_at', null);
      if (error) {
        console.warn('[notif-history] unread global count failed', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

  // KPI: trend (current 7d vs previous 7d) — only based on v2+v1
  const trendQuery = useQuery({
    queryKey: ['notif-history', 'trend', userId],
    queryFn: async () => {
      if (!userId) return { current: 0, previous: 0 };
      const now = new Date();
      const last7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const last14 = new Date(now.getTime() - 14 * 86400000).toISOString();
      const [c1, c2] = await Promise.all([
        supabase
          .from('notifications_v2')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', last7),
        supabase
          .from('notifications_v2')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', last14)
          .lt('created_at', last7),
      ]);
      return { current: c1.count ?? 0, previous: c2.count ?? 0 };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const allItems: InboxItem[] = useMemo(() => {
    const list = normalizeInboxItems({
      v2Rows: v2Query.data ?? [],
      v1Rows: v1Query.data ?? [],
      releaseNotes: newsQuery.data ?? [],
      readNewsIds,
      mapNewsMeta: (note) => ({ version: note.version, is_major: note.is_major, changes: note.changes }),
    }) as InboxItem[];

    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [v2Query.data, v1Query.data, newsQuery.data, readNewsIds]);

  // Apply filters (search, status, category, priority, source)
  const filtered = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    const now = Date.now();
    return allItems.filter((i) => {
      // source
      if (!filters.sources.includes(i.source)) return false;
      // category — 'priority' filter shows critical/high
      if (filters.categories.length > 0) {
        const isPriorityCategory = i.priority === 'critical' || i.priority === 'high';
        const matchesCategory = filters.categories.includes(i.category);
        const matchesPrioritySlot = filters.categories.includes('priority') && isPriorityCategory;
        if (!matchesCategory && !matchesPrioritySlot) return false;
      }
      // priority
      if (!filters.priorities.includes(i.priority)) return false;
      // status
      const snoozed = !!(i.snoozed_until && new Date(i.snoozed_until).getTime() > now);
      const dismissed = !!i.dismissed_at;
      const read = !!i.read_at && !dismissed && !snoozed;
      const unread = !i.read_at && !dismissed && !snoozed;
      const statusMatches =
        (filters.status.includes('unread') && unread) ||
        (filters.status.includes('read') && read) ||
        (filters.status.includes('dismissed') && dismissed) ||
        (filters.status.includes('snoozed') && snoozed);
      if (!statusMatches) return false;
      // search
      if (s) {
        const hay = `${i.title} ${i.message ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allItems, filters]);

  // KPIs (against allItems, before filter — except period)
  const kpis = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let total = 0;
    let critical = 0;
    let today = 0;
    for (const i of allItems) {
      if (i.dismissed_at) continue;
      total += 1;
      if ((i.priority === 'critical' || i.priority === 'high') && !i.read_at) critical += 1;
      if (new Date(i.created_at).getTime() >= todayStart.getTime()) today += 1;
    }
    const trendCurrent = trendQuery.data?.current ?? 0;
    const trendPrev = trendQuery.data?.previous ?? 0;
    const trendPct =
      trendPrev > 0 ? Math.round(((trendCurrent - trendPrev) / trendPrev) * 100) : 0;
    return { total, critical, today, trendPct, trendCurrent };
  }, [allItems, trendQuery.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notif-history'] });
  const invalidateInbox = () =>
    queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });

  const markRead = useMutation({
    mutationFn: async (item: InboxItem) => {
      if (item.source === 'v2') {
        await supabase
          .from('notifications_v2')
          .update({ read_at: new Date().toISOString(), status: 'read' as any })
          .eq('id', item.id)
          .eq('user_id', userId!);
      } else if (item.source === 'v1') {
        const realId = item.id.replace('v1:', '');
        await supabase
          .from('notifications')
          .update({ read: true, read_at: new Date().toISOString() } as any)
          .eq('id', realId)
          .eq('user_id', userId!);
      } else if (item.source === 'release_note') {
        const realId = item.id.replace('news:', '');
        if (!readNewsIds.includes(realId)) {
          const next = [...readNewsIds, realId];
          setReadNewsIds(next);
          try {
            localStorage.setItem(READ_NEWS_KEY, JSON.stringify(next));
          } catch {}
        }
      }
    },
    onSuccess: () => {
      invalidate();
      invalidateInbox();
    },
  });

  const dismiss = useMutation({
    mutationFn: async (item: InboxItem) => {
      if (item.source === 'v2') {
        await supabase
          .from('notifications_v2')
          .update({ dismissed_at: new Date().toISOString(), status: 'dismissed' as any })
          .eq('id', item.id)
          .eq('user_id', userId!);
      } else if (item.source === 'v1') {
        const realId = item.id.replace('v1:', '');
        await supabase
          .from('notifications')
          .update({ read: true } as any)
          .eq('id', realId)
          .eq('user_id', userId!);
      }
    },
    onSuccess: () => {
      invalidate();
      invalidateInbox();
    },
  });

  const snooze = useMutation({
    mutationFn: async ({ item, hours }: { item: InboxItem; hours: number }) => {
      if (item.source !== 'v2') return;
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await supabase
        .from('notifications_v2')
        .update({ snoozed_until: until })
        .eq('id', item.id)
        .eq('user_id', userId!);
    },
    onSuccess: () => {
      invalidate();
      invalidateInbox();
    },
  });

  const bulkMarkRead = useMutation({
    mutationFn: async (items: InboxItem[]) => {
      const v2Ids = items.filter((i) => i.source === 'v2' && !i.read_at).map((i) => i.id);
      const v1Ids = items
        .filter((i) => i.source === 'v1' && !i.read_at)
        .map((i) => i.id.replace('v1:', ''));
      const newsIds = items
        .filter((i) => i.source === 'release_note' && !i.read_at)
        .map((i) => i.id.replace('news:', ''));
      if (v2Ids.length && userId) {
        await supabase
          .from('notifications_v2')
          .update({ read_at: new Date().toISOString(), status: 'read' as any })
          .in('id', v2Ids)
          .eq('user_id', userId);
      }
      if (v1Ids.length && userId) {
        await supabase
          .from('notifications')
          .update({ read: true } as any)
          .in('id', v1Ids)
          .eq('user_id', userId);
      }
      if (newsIds.length) {
        const merged = [...new Set([...readNewsIds, ...newsIds])];
        setReadNewsIds(merged);
        try {
          localStorage.setItem(READ_NEWS_KEY, JSON.stringify(merged));
        } catch {}
      }
    },
    onSuccess: () => {
      invalidate();
      invalidateInbox();
    },
  });

  const bulkDismiss = useMutation({
    mutationFn: async (items: InboxItem[]) => {
      const v2Ids = items.filter((i) => i.source === 'v2').map((i) => i.id);
      if (v2Ids.length && userId) {
        await supabase
          .from('notifications_v2')
          .update({ dismissed_at: new Date().toISOString(), status: 'dismissed' as any })
          .in('id', v2Ids)
          .eq('user_id', userId);
      }
    },
    onSuccess: () => {
      invalidate();
      invalidateInbox();
    },
  });

  // Marca TUDO como lido — globalmente (ignora filtros de período)
  const markAllReadGlobal = useMutation({
    mutationFn: async () => {
      if (!userId) return { v2: 0, v1: 0, news: 0 };
      const nowIso = new Date().toISOString();

      const { error: e2, count: v2Count } = await supabase
        .from('notifications_v2')
        .update({ read_at: nowIso, status: 'read' as any }, { count: 'exact' })
        .eq('user_id', userId)
        .is('read_at', null);
      if (e2) console.warn('[notif-history] markAllReadGlobal v2 failed', e2);

      const { error: e1, count: v1Count } = await supabase
        .from('notifications')
        .update({ read: true, read_at: nowIso } as any, { count: 'exact' })
        .eq('user_id', userId)
        .eq('read', false);
      if (e1) console.warn('[notif-history] markAllReadGlobal v1 failed', e1);

      const { data: allNotes } = await supabase
        .from('release_notes')
        .select('id')
        .limit(200);
      const allNewsIds = (allNotes ?? []).map((n) => n.id);
      const merged = [...new Set([...readNewsIds, ...allNewsIds])];
      setReadNewsIds(merged);
      try {
        localStorage.setItem(READ_NEWS_KEY, JSON.stringify(merged));
      } catch {}

      return { v2: v2Count ?? 0, v1: v1Count ?? 0, news: allNewsIds.length };
    },
    onSuccess: () => {
      invalidate();
      invalidateInbox();
      queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
    },
  });

  // Realtime — único canal v2 mantido para a página de histórico.
  // SPRINT PERF 0.6B: invalida também `unified-inbox` para evitar que
  // outro consumidor precise manter canal próprio em paralelo.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-history-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications_v2', filter: `user_id=eq.${userId}` },
        () => {
          invalidate();
          invalidateInbox();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    items: filtered,
    allItems,
    kpis,
    unreadGlobal: unreadGlobalQuery.data ?? 0,
    isLoading: v2Query.isLoading || v1Query.isLoading,
    markRead: markRead.mutate,
    dismiss: dismiss.mutate,
    snooze: snooze.mutate,
    bulkMarkRead: bulkMarkRead.mutate,
    bulkDismiss: bulkDismiss.mutate,
    markAllReadGlobal: markAllReadGlobal.mutateAsync,
    isMarkingAllRead: markAllReadGlobal.isPending,
  };
}

export function exportToCsv(items: InboxItem[]) {
  const header = ['id', 'origem', 'tipo', 'titulo', 'mensagem', 'prioridade', 'categoria', 'criado_em', 'lida_em', 'dispensada_em'];
  const rows = items.map((i) => [
    i.id,
    i.source,
    i.type,
    `"${(i.title ?? '').replace(/"/g, '""')}"`,
    `"${(i.message ?? '').replace(/"/g, '""')}"`,
    i.priority,
    i.category,
    i.created_at,
    i.read_at ?? '',
    i.dismissed_at ?? '',
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notificacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
