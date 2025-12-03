import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Tag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export function useOrganizationTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;
      setTags(data || []);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching tags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const createTag = async (name: string, color: string = '#3B82F6'): Promise<Tag | null> => {
    try {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('User must belong to an organization');

      const { data, error } = await supabase
        .from('tags')
        .insert({ name, color, organization_id: orgId })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh tags list
      await fetchTags();
      return data;
    } catch (err) {
      console.error('Error creating tag:', err);
      return null;
    }
  };

  return { tags, loading, error, createTag, refetch: fetchTags };
}

export async function getOpportunityTags(opportunityId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('opportunity_tags')
    .select('tag_id')
    .eq('opportunity_id', opportunityId);

  if (error) {
    console.error('Error fetching opportunity tags:', error);
    return [];
  }

  return data.map(t => t.tag_id);
}

export async function setOpportunityTags(opportunityId: string, tagIds: string[]): Promise<void> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('User must belong to an organization');

  // Delete existing tags
  await supabase
    .from('opportunity_tags')
    .delete()
    .eq('opportunity_id', opportunityId);

  // Insert new tags
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('opportunity_tags')
      .insert(tagIds.map(tagId => ({
        opportunity_id: opportunityId,
        tag_id: tagId,
        organization_id: orgId,
      })));

    if (error) throw error;
  }
}
