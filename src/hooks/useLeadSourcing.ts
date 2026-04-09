import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from 'sonner';

export interface LeadSearch {
  id: string;
  organization_id: string;
  user_id: string;
  search_type: string;
  icp_id: string | null;
  config: Record<string, any>;
  status: string;
  results_count: number;
  approved_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface LeadSearchResult {
  id: string;
  search_id: string;
  organization_id: string;
  company_name: string;
  origin: string | null;
  city: string | null;
  state: string | null;
  score: number;
  signals: Record<string, any>;
  reason: string | null;
  status: string;
  opportunity_id: string | null;
  created_at: string;
}

export function useLeadSearches() {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['lead-searches', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('lead_searches')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as LeadSearch[];
    },
    enabled: !!organization?.id,
  });
}

export function useLeadSearchResults(searchId: string | null) {
  return useQuery({
    queryKey: ['lead-search-results', searchId],
    queryFn: async () => {
      if (!searchId) return [];
      const { data, error } = await supabase
        .from('lead_search_results')
        .select('*')
        .eq('search_id', searchId)
        .order('score', { ascending: false });
      if (error) throw error;
      return data as LeadSearchResult[];
    },
    enabled: !!searchId,
  });
}

export function useExecuteLeadSearch() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (params: {
      search_type: string;
      icp_id: string | null;
      config: Record<string, any>;
    }) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('lead-sourcing', {
        body: {
          organization_id: organization.id,
          search_type: params.search_type,
          icp_id: params.icp_id,
          config: params.config,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-searches'] });
      queryClient.invalidateQueries({ queryKey: ['lead-search-results'] });
      toast.success('Busca de leads concluída!');
    },
    onError: (error) => {
      console.error('Lead search error:', error);
      toast.error('Erro ao executar busca de leads');
    },
  });
}

export function useUpdateLeadResultStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resultId, status }: { resultId: string; status: string }) => {
      const { data, error } = await supabase
        .from('lead_search_results')
        .update({ status })
        .eq('id', resultId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-search-results'] });
      queryClient.invalidateQueries({ queryKey: ['lead-searches'] });
    },
  });
}
