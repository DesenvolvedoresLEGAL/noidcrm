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

export async function listAccountTagsBulk(
  accountIds: string[],
): Promise<Record<string, { id: string; name: string; color: string }[]>> {
  if (accountIds.length === 0) return {};

  const { data, error } = await supabase
    .from('account_tags')
    .select('account_id, tag:tags(id, name, color)')
    .in('account_id', accountIds);

  if (error) {
    console.error('Error fetching bulk account tags:', error);
    return {};
  }

  const map: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const row of data || []) {
    const tag = (row as any).tag;
    if (!tag) continue;
    if (!map[(row as any).account_id]) map[(row as any).account_id] = [];
    map[(row as any).account_id].push({ id: tag.id, name: tag.name, color: tag.color });
  }
  return map;
}
