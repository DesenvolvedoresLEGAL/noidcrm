import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { normalizeInboxItems } from '@/lib/notifications/normalizeInboxItems';

export type InboxPriority = 'critical' | 'high' | 'medium' | 'low';
export type InboxCategory = 'priority' | 'activities' | 'proposals' | 'conversations' | 'news' | 'all';
export type InboxSource = 'v2' | 'v1' | 'release_note';

export interface InboxItem {
  id: string;
  source: InboxSource;
  type: string;
  title: string;
  message: string | null;
  priority: InboxPriority;
  category: InboxCategory;
  action_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  meta?: Record<string, any>;
}

export interface DailyDigestSummary {
  overdue_activities?: number;
  today_activities?: number;
  proposals_viewed_24h?: number;
  proposals_due_today?: number;
  proposals_due_tomorrow?: number;
  client_replies_24h?: number;
  no_activity_opportunities?: number;
  total_priorities?: number;
  [key: string]: any;
}

const READ_NEWS_KEY = 'read_news_ids';
const TAB_KEY = 'noid_inbox_tab';

const PRIORITY_RANK: Record<InboxPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getReadNewsIds(): string[] {
  try {
    const stored = localStorage.getItem(READ_NEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function usePersistedInboxTab(defaultTab: InboxCategory = 'priority') {
  const [tab, setTab] = useState<InboxCategory>(() => {
    try {
      const stored = localStorage.getItem(TAB_KEY) as InboxCategory | null;
      return stored ?? defaultTab;
    } catch {
      return defaultTab;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {}
  }, [tab]);
  return [tab, setTab] as const;
}

/**
 * Sprint PERF 0.2 — `active` controla quais subqueries pesadas + canal realtime montam.
 * - active=false (sidebar fechada): apenas v2 + news ficam ativas (necessárias para o badge).
 * - active=true (Sheet aberta): liga v1 legacy, digest e canal realtime.
 * Não altera nenhuma regra de negócio — apenas reduz tráfego quando a inbox não está em uso.
 */
export function useUnifiedInbox(options: { active?: boolean } = {}) {
  const { active = true } = options;
  const { user } = useCurrentUser();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [readNewsIds, setReadNewsIds] = useState<string[]>(getReadNewsIds);

  // Source 1: notifications_v2 (PRIME - main source)
  const v2Query = useQuery({
    queryKey: ['unified-inbox', 'v2', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications_v2')
        .select('*')
        .eq('user_id', userId)
        .eq('channel_in_app', true)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

  // Source 2: legacy notifications (v1)
  const v1Query = useQuery({
    queryKey: ['unified-inbox', 'v1', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.warn('[unified-inbox] legacy notifications fetch failed', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!userId && active,
    staleTime: 1000 * 60,
  });

  // Source 3: release notes (Novidades) — leve e usado pelo badge, sempre ativo.
  const newsQuery = useQuery({
    queryKey: ['unified-inbox', 'release-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('release_notes')
        .select('id, version, title, description, release_date, is_major, changes')
        .order('release_date', { ascending: false })
        .limit(10);
      if (error) {
        console.warn('[unified-inbox] release notes fetch failed', error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Source 4: daily digest (sticky resumo) — só quando inbox está aberta.
  const digestQuery = useQuery({
    queryKey: ['unified-inbox', 'digest', userId],
    queryFn: async () => {
      if (!userId) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('daily_digest_cache')
        .select('summary_json, digest_date')
        .eq('user_id', userId)
        .eq('digest_date', today)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!userId && active,
    staleTime: 1000 * 60 * 15,
  });

  const items: InboxItem[] = useMemo(() => {
    const list = normalizeInboxItems({
      v2Rows: v2Query.data ?? [],
      v1Rows: v1Query.data ?? [],
      releaseNotes: newsQuery.data ?? [],
      readNewsIds,
      hideFutureSnoozedV2: true,
      mapNewsMeta: (note) => ({ version: note.version, is_major: note.is_major }),
    }) as InboxItem[];

    return list.sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority];
      const pb = PRIORITY_RANK[b.priority];
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [v2Query.data, v1Query.data, newsQuery.data, readNewsIds]);

  // Counts
  const counts = useMemo(() => {
    const c = {
      total: 0,
      priority: 0,
      activities: 0,
      proposals: 0,
      conversations: 0,
      news: 0,
      unread: 0,
      badge: 0,
    };
    for (const i of items) {
      const isUnread = !i.read_at;
      if (isUnread) c.unread += 1;
      if (i.category === 'activities' && isUnread) c.activities += 1;
      if (i.category === 'proposals' && isUnread) c.proposals += 1;
      if (i.category === 'conversations' && isUnread) c.conversations += 1;
      if (i.category === 'news' && isUnread) c.news += 1;
      if ((i.priority === 'critical' || i.priority === 'high') && isUnread) c.priority += 1;
      c.total += 1;
    }
    // Badge unifica: críticas/altas + novidades não lidas
    c.badge = c.priority + c.news;
    return c;
  }, [items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['notif-history'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-center'] });
  };

  // Mutations
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
          .update({ read: true } as any)
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
    onSuccess: invalidate,
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
      } else if (item.source === 'release_note') {
        await markRead.mutateAsync(item);
      }
    },
    onSuccess: invalidate,
  });

  const snooze = useMutation({
    mutationFn: async ({ item, hours }: { item: InboxItem; hours: number }) => {
      if (item.source !== 'v2') return; // snooze só aplicável no v2
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await supabase
        .from('notifications_v2')
        .update({ snoozed_until: until })
        .eq('id', item.id)
        .eq('user_id', userId!);
    },
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      // v2
      await supabase
        .from('notifications_v2')
        .update({ read_at: new Date().toISOString(), status: 'read' as any })
        .eq('user_id', userId)
        .is('read_at', null);
      // v1
      await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('user_id', userId)
        .eq('read', false);
      // news
      const allNewsIds = (newsQuery.data ?? []).map((n) => n.id);
      const merged = [...new Set([...readNewsIds, ...allNewsIds])];
      setReadNewsIds(merged);
      try {
        localStorage.setItem(READ_NEWS_KEY, JSON.stringify(merged));
      } catch {}
    },
    onSuccess: invalidate,
  });

  // Realtime invalidation — só assina quando inbox está ativa (Sheet aberta).
  // Quando o Sheet abre, o canal monta e invalida; quando fecha, desmonta o WS.
  // O badge continua reagindo via refetchOnFocus + staleTime do v2.
  useEffect(() => {
    if (!userId || !active) return;
    const channel = supabase
      .channel(`unified-inbox-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications_v2', filter: `user_id=eq.${userId}` },
        () => invalidate(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, active]);

  return {
    items,
    counts,
    digest: (digestQuery.data?.summary_json ?? null) as DailyDigestSummary | null,
    isLoading: v2Query.isLoading || v1Query.isLoading,
    markRead: markRead.mutate,
    dismiss: dismiss.mutate,
    snooze: snooze.mutate,
    markAllRead: markAllRead.mutate,
  };
}
