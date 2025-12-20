import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

export type SuggestionStatus = 'under_review' | 'planned' | 'in_development' | 'launched' | 'declined';
export type ImpactArea = 'sales' | 'ai' | 'cs' | 'ux' | 'other';
export type PerceivedImpact = 'low' | 'medium' | 'high' | 'critical';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  impact_area: ImpactArea;
  perceived_impact: PerceivedImpact;
  status: SuggestionStatus;
  votes_count: number;
  comments_count: number;
  is_featured: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  has_voted?: boolean;
}

export interface SuggestionComment {
  id: string;
  suggestion_id: string;
  user_id: string;
  content: string;
  is_team_response: boolean;
  created_at: string;
}

export interface CreateSuggestionData {
  title: string;
  description: string;
  impact_area: ImpactArea;
  perceived_impact: PerceivedImpact;
}

export function useSuggestions(statusFilter?: SuggestionStatus) {
  const { user } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const suggestionsQuery = useQuery({
    queryKey: ['community-suggestions', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('community_suggestions')
        .select('*')
        .order('votes_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get user's votes if logged in
      let userVotes: string[] = [];
      if (user) {
        const { data: votes } = await supabase
          .from('community_suggestion_votes')
          .select('suggestion_id')
          .eq('user_id', user.id);
        userVotes = votes?.map(v => v.suggestion_id) || [];
      }

      return (data || []).map(s => ({
        ...s,
        has_voted: userVotes.includes(s.id)
      })) as Suggestion[];
    },
    enabled: true,
    staleTime: 30000,
  });

  const createSuggestion = useMutation({
    mutationFn: async (data: CreateSuggestionData) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('community_suggestions')
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
      queryClient.invalidateQueries({ queryKey: ['community-suggestions'] });
      toast.success('Sugestão enviada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating suggestion:', error);
      toast.error('Erro ao enviar sugestão');
    },
  });

  const voteSuggestion = useMutation({
    mutationFn: async ({ suggestionId, hasVoted }: { suggestionId: string; hasVoted: boolean }) => {
      if (!user) throw new Error('Usuário não autenticado');

      if (hasVoted) {
        // Remove vote
        const { error } = await supabase
          .from('community_suggestion_votes')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Add vote
        const { error } = await supabase
          .from('community_suggestion_votes')
          .insert({
            suggestion_id: suggestionId,
            user_id: user.id,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-suggestions'] });
    },
  });

  return {
    suggestions: suggestionsQuery.data || [],
    isLoading: suggestionsQuery.isLoading,
    error: suggestionsQuery.error,
    createSuggestion,
    voteSuggestion,
  };
}

export function useSuggestionDetail(suggestionId: string | undefined) {
  const { user } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const suggestionQuery = useQuery({
    queryKey: ['community-suggestion', suggestionId],
    queryFn: async () => {
      if (!suggestionId) return null;

      const { data, error } = await supabase
        .from('community_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (error) throw error;

      // Check if user has voted
      let hasVoted = false;
      if (user) {
        const { data: vote } = await supabase
          .from('community_suggestion_votes')
          .select('id')
          .eq('suggestion_id', suggestionId)
          .eq('user_id', user.id)
          .maybeSingle();
        hasVoted = !!vote;
      }

      return { ...data, has_voted: hasVoted } as Suggestion;
    },
    enabled: !!suggestionId,
  });

  const commentsQuery = useQuery({
    queryKey: ['community-suggestion-comments', suggestionId],
    queryFn: async () => {
      if (!suggestionId) return [];

      const { data, error } = await supabase
        .from('community_suggestion_comments')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SuggestionComment[];
    },
    enabled: !!suggestionId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !suggestionId) throw new Error('Dados inválidos');

      const { error } = await supabase
        .from('community_suggestion_comments')
        .insert({
          suggestion_id: suggestionId,
          user_id: user.id,
          content,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-suggestion-comments', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['community-suggestions'] });
      toast.success('Comentário adicionado!');
    },
    onError: () => {
      toast.error('Erro ao adicionar comentário');
    },
  });

  return {
    suggestion: suggestionQuery.data,
    comments: commentsQuery.data || [],
    isLoading: suggestionQuery.isLoading || commentsQuery.isLoading,
    addComment,
  };
}
