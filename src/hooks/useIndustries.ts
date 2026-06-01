import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from 'sonner';

export interface Industry {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  is_active: boolean;
  is_system_default: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useIndustries() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id;
  const queryClient = useQueryClient();

  // Fetch industries (system defaults + org-specific)
  const { data: industries = [], isLoading } = useQuery({
    queryKey: ['industries', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Industry[];
    },
    enabled: !!organizationId,
    // SPRINT PERF 0.4 — catálogo raramente alterado. Mutations abaixo invalidam ['industries'].
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch only system defaults (for onboarding when user has no org yet)
  const { data: systemDefaults = [], isLoading: isLoadingDefaults } = useQuery({
    queryKey: ['industries', 'system-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .is('organization_id', null)
        .eq('is_active', true)
        .eq('is_system_default', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Industry[];
    },
    // SPRINT PERF 0.4 — defaults do sistema praticamente imutáveis.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Create org-specific industry
  const createIndustry = useMutation({
    mutationFn: async (data: { name: string; description?: string; icon?: string }) => {
      if (!organizationId) throw new Error('No organization');
      
      const maxOrder = industries.reduce((max, ind) => 
        ind.organization_id === organizationId ? Math.max(max, ind.display_order) : max, 0);

      const { data: result, error } = await supabase
        .from('industries')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description,
          icon: data.icon || 'Building2',
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
      toast.success('Indústria criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar indústria: ' + error.message);
    },
  });

  // Update industry
  const updateIndustry = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; icon?: string; is_active?: boolean }) => {
      const { data: result, error } = await supabase
        .from('industries')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
      toast.success('Indústria atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Delete industry
  const deleteIndustry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('industries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
      toast.success('Indústria removida');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  // Get merged list (org-specific override system defaults with same name)
  const mergedIndustries = () => {
    const orgIndustries = industries.filter(i => i.organization_id === organizationId);
    const orgNames = new Set(orgIndustries.map(i => i.name.toLowerCase()));
    
    const systemOnly = industries.filter(i => 
      i.is_system_default && !orgNames.has(i.name.toLowerCase())
    );

    return [...orgIndustries, ...systemOnly].sort((a, b) => a.display_order - b.display_order);
  };

  return {
    industries: mergedIndustries(),
    systemDefaults,
    isLoading: isLoading || isLoadingDefaults,
    createIndustry,
    updateIndustry,
    deleteIndustry,
  };
}
