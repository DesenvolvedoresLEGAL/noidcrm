import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

export type CaseCategory = 'win_story' | 'learning' | 'tip' | 'process';

export interface CommunityCase {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: CaseCategory;
  likes_count: number;
  views_count: number;
  is_featured: boolean;
  is_approved: boolean;
  user_id: string;
  created_at: string;
}

export interface CreateCaseData {
  title: string;
  summary: string;
  content: string;
  category: CaseCategory;
}

export function useCases(categoryFilter?: CaseCategory) {
  const { user } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const casesQuery = useQuery({
    queryKey: ['community-cases', categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('community_cases')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunityCase[];
    },
    staleTime: 30000,
  });

  const createCase = useMutation({
    mutationFn: async (data: CreateCaseData) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('community_cases')
        .insert({
          ...data,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-cases'] });
      toast.success('Case enviado para aprovação!');
    },
    onError: () => {
      toast.error('Erro ao criar case');
    },
  });

  return {
    cases: casesQuery.data || [],
    isLoading: casesQuery.isLoading,
    error: casesQuery.error,
    createCase,
  };
}
