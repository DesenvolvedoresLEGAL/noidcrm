export interface NormalizeInboxItemsParams {
  v2Rows: any[];
  v1Rows: any[];
  releaseNotes: any[];
  readNewsIds: string[];
  hideFutureSnoozedV2?: boolean;
  nowMs?: number;
  dedupeWindowMs?: number;
  mapNewsMeta?: (note: any) => Record<string, any> | undefined;
}

function categorize(type: string): 'activities' | 'proposals' | 'conversations' | 'all' {
  if (!type) return 'all';
  if (type.startsWith('activity_')) return 'activities';
  if (type.startsWith('proposal_')) return 'proposals';
  // Won deals are surfaced in the Propostas tab so reps see closed business
  // alongside the proposal lifecycle events that produced them.
  if (type === 'deal_won' || type === 'team_deal_won') return 'proposals';
  if (type === 'client_replied' || type === 'email_reply_received') return 'conversations';
  return 'all';
}

export function normalizeInboxItems({
  v2Rows,
  v1Rows,
  releaseNotes,
  readNewsIds,
  hideFutureSnoozedV2 = false,
  nowMs = Date.now(),
  dedupeWindowMs = 5000,
  mapNewsMeta,
}: NormalizeInboxItemsParams) {
  const list: any[] = [];

  for (const n of v2Rows ?? []) {
    if (hideFutureSnoozedV2 && n.snoozed_until && new Date(n.snoozed_until).getTime() > nowMs) {
      continue;
    }
    list.push({
      id: n.id,
      source: 'v2',
      type: n.type,
      title: n.title,
      message: n.message,
      priority: n.priority ?? 'medium',
      category: categorize(n.type),
      action_url: n.action_url,
      read_at: n.read_at,
      dismissed_at: n.dismissed_at,
      snoozed_until: n.snoozed_until ?? null,
      created_at: n.created_at,
      meta: (n as any).metadata ?? undefined,
    });
  }

  for (const n of v1Rows ?? []) {
    const dup = list.some(
      (i) =>
        i.source === 'v2' &&
        i.title === n.title &&
        Math.abs(new Date(i.created_at).getTime() - new Date(n.created_at).getTime()) < dedupeWindowMs,
    );
    if (dup) continue;
    list.push({
      id: `v1:${n.id}`,
      source: 'v1',
      type: n.type ?? 'legacy',
      title: n.title,
      message: n.message ?? null,
      priority: 'medium',
      category: categorize(n.type ?? ''),
      action_url: (n as any).action_url ?? null,
      read_at: n.read ? n.created_at : null,
      dismissed_at: null,
      snoozed_until: null,
      created_at: n.created_at,
      meta: (n as any).metadata ?? undefined,
    });
  }

  for (const note of releaseNotes ?? []) {
    const isRead = readNewsIds.includes(note.id);
    list.push({
      id: `news:${note.id}`,
      source: 'release_note',
      type: 'release_note',
      title: note.title,
      message: note.description ?? null,
      priority: note.is_major ? 'high' : 'low',
      category: 'news',
      action_url: '/app/release-notes',
      read_at: isRead ? note.release_date : null,
      dismissed_at: null,
      snoozed_until: null,
      created_at: note.release_date,
      meta: mapNewsMeta
        ? mapNewsMeta(note)
        : { version: note.version, is_major: note.is_major },
    });
  }

  return list;
}
