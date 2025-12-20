import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

export type DiscussionCategory = 'question' | 'best_practice' | 'tip' | 'discussion';

export interface Discussion {
  id: string;
  title: string;
  content: string;
  category: DiscussionCategory;
  tags: string[];
  views_count: number;
  replies_count: number;
  is_pinned: boolean;
  is_answered: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionReply {
  id: string;
  discussion_id: string;
  user_id: string;
  content: string;
  is_accepted_answer: boolean;
  created_at: string;
}

export interface CreateDiscussionData {
  title: string;
  content: string;
  category: DiscussionCategory;
  tags?: string[];
}

export function useDiscussions(categoryFilter?: DiscussionCategory) {
  const { user } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const discussionsQuery = useQuery({
    queryKey: ['community-discussions', categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('community_discussions')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Discussion[];
    },
    staleTime: 30000,
  });

  const createDiscussion = useMutation({
    mutationFn: async (data: CreateDiscussionData) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('community_discussions')
        .insert({
          ...data,
          user_id: user.id,
          tags: data.tags || [],
        } as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-discussions'] });
      toast.success('Discussão criada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar discussão');
    },
  });

  return {
    discussions: discussionsQuery.data || [],
    isLoading: discussionsQuery.isLoading,
    error: discussionsQuery.error,
    createDiscussion,
  };
}

export function useDiscussionDetail(discussionId: string | undefined) {
  const { user } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const discussionQuery = useQuery({
    queryKey: ['community-discussion', discussionId],
    queryFn: async () => {
      if (!discussionId) return null;

      const { data, error } = await supabase
        .from('community_discussions')
        .select('*')
        .eq('id', discussionId)
        .single();

      if (error) throw error;
      return data as Discussion;
    },
    enabled: !!discussionId,
  });

  const repliesQuery = useQuery({
    queryKey: ['community-discussion-replies', discussionId],
    queryFn: async () => {
      if (!discussionId) return [];

      const { data, error } = await supabase
        .from('community_discussion_replies')
        .select('*')
        .eq('discussion_id', discussionId)
        .order('is_accepted_answer', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as DiscussionReply[];
    },
    enabled: !!discussionId,
  });

  const addReply = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !discussionId) throw new Error('Dados inválidos');

      const { error } = await supabase
        .from('community_discussion_replies')
        .insert({
          discussion_id: discussionId,
          user_id: user.id,
          content,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-discussion-replies', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['community-discussions'] });
      toast.success('Resposta adicionada!');
    },
    onError: () => {
      toast.error('Erro ao adicionar resposta');
    },
  });

  return {
    discussion: discussionQuery.data,
    replies: repliesQuery.data || [],
    isLoading: discussionQuery.isLoading || repliesQuery.isLoading,
    addReply,
  };
}
