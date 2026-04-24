import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TagScoreStat {
  tagId: string;
  name: string;
  color: string;
  count: number;
  averageScore: number;
}

async function fetchAccountTagsForOrg(organizationId: string) {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('account_tags')
      .select('tag_id, tag:tags(id, name, color), account:accounts(id, lead_score, lead_grade, deleted_at)')
      .eq('organization_id', organizationId)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching account_tags for org:', error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export function useLeadScoreByTag(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['lead-score-by-tag', organizationId],
    enabled: !!organizationId,
    staleTime: 30_000,
    queryFn: async (): Promise<TagScoreStat[]> => {
      const rows = await fetchAccountTagsForOrg(organizationId!);

      const acc = new Map<string, { name: string; color: string; scores: number[]; count: number }>();

      for (const r of rows) {
        const tag = r.tag;
        const account = r.account;
        if (!tag || !account) continue;
        if (account.deleted_at) continue;

        const cur = acc.get(tag.id) || { name: tag.name, color: tag.color, scores: [], count: 0 };
        cur.count += 1;
        if (typeof account.lead_score === 'number') cur.scores.push(account.lead_score);
        acc.set(tag.id, cur);
      }

      const stats: TagScoreStat[] = Array.from(acc.entries()).map(([tagId, v]) => ({
        tagId,
        name: v.name,
        color: v.color,
        count: v.count,
        averageScore: v.scores.length
          ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length)
          : 0,
      }));

      stats.sort((a, b) => b.count - a.count);
      return stats;
    },
  });
}

export interface AccountByTagRow {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  lead_score: number | null;
  lead_grade: string | null;
}

export function useAccountsByTagWithScore(tagId: string | undefined) {
  return useQuery({
    queryKey: ['accounts-by-tag-with-score', tagId],
    enabled: !!tagId,
    staleTime: 30_000,
    queryFn: async (): Promise<AccountByTagRow[]> => {
      // 1) Pega todos os account_ids da tag (paginado)
      const ids: string[] = [];
      const pageSize = 1000;
      let from = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('account_tags')
          .select('account_id')
          .eq('tag_id', tagId!)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error(error);
          break;
        }
        if (!data || data.length === 0) break;
        ids.push(...data.map((r: any) => r.account_id));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (ids.length === 0) return [];

      // 2) Carrega accounts em chunks
      const all: AccountByTagRow[] = [];
      const idChunkSize = 500;

      for (let i = 0; i < ids.length; i += idChunkSize) {
        const chunk = ids.slice(i, i + idChunkSize);
        const { data, error } = await supabase
          .from('accounts')
          .select('id, razao_social, nome_fantasia, lead_score, lead_grade, deleted_at')
          .in('id', chunk)
          .is('deleted_at', null);

        if (error) {
          console.error(error);
          continue;
        }
        for (const a of data || []) {
          all.push({
            id: (a as any).id,
            razao_social: (a as any).razao_social,
            nome_fantasia: (a as any).nome_fantasia,
            lead_score: (a as any).lead_score,
            lead_grade: (a as any).lead_grade,
          });
        }
      }

      all.sort((a, b) => (b.lead_score ?? -1) - (a.lead_score ?? -1));
      return all;
    },
  });
}
