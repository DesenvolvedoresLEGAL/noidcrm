import { supabase } from '@/integrations/supabase/client';

export interface AccountTagLink {
  id: string;
  account_id: string;
  tag_id: string;
  organization_id: string;
}

export async function getAccountTagIds(accountId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('account_tags')
    .select('tag_id')
    .eq('account_id', accountId);

  if (error) {
    console.error('Error fetching account tags:', error);
    return [];
  }
  return (data || []).map((r) => r.tag_id);
}

export async function setAccountTags(accountId: string, tagIds: string[]): Promise<void> {
  const { data: orgId, error: orgErr } = await supabase.rpc('get_user_organization_id');
  if (orgErr) throw orgErr;
  if (!orgId) throw new Error('Usuário sem organização');

  // Apaga vínculos atuais
  const { error: delErr } = await supabase
    .from('account_tags')
    .delete()
    .eq('account_id', accountId);
  if (delErr) throw delErr;

  if (tagIds.length === 0) return;

  const { error: insErr } = await supabase
    .from('account_tags')
    .insert(
      tagIds.map((tagId) => ({
        account_id: accountId,
        tag_id: tagId,
        organization_id: orgId as unknown as string,
      })),
    );
  if (insErr) throw insErr;
}

/**
 * Retorna TODOS os account_ids vinculados a uma tag, paginando para
 * contornar o limite padrão de 1000 rows do PostgREST.
 */
export async function getAccountIdsByTag(tagId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('account_tags')
      .select('account_id')
      .eq('tag_id', tagId)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching account ids by tag:', error);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data) ids.add((r as any).account_id);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

export async function listAccountTagsBulk(
  accountIds: string[],
): Promise<Record<string, { id: string; name: string; color: string }[]>> {
  if (accountIds.length === 0) return {};

  const map: Record<string, { id: string; name: string; color: string }[]> = {};

  // Chunks de IDs para evitar URLs muito longas
  const idChunkSize = 500;

  for (let i = 0; i < accountIds.length; i += idChunkSize) {
    const idChunk = accountIds.slice(i, i + idChunkSize);

    // Pagina dentro do chunk para escapar do limite de 1000 rows
    const pageSize = 1000;
    let from = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('account_tags')
        .select('account_id, tag:tags(id, name, color)')
        .in('account_id', idChunk)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching bulk account tags:', error);
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        const tag = (row as any).tag;
        if (!tag) continue;
        const accId = (row as any).account_id;
        if (!map[accId]) map[accId] = [];
        map[accId].push({ id: tag.id, name: tag.name, color: tag.color });
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  return map;
}
