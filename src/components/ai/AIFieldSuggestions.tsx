import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, X, Loader2, RefreshCw } from 'lucide-react';
import { generateFieldSuggestions, acceptSuggestion, rejectSuggestion, type AISuggestion } from '@/services/crm/ai-automation';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateOpportunity } from '@/lib/cache-invalidation';
import { aiSuggestionKeys } from '@/lib/query-keys';
import { supabase } from '@/integrations/supabase/client';

interface AIFieldSuggestionsProps {
  opportunityId: string;
  onAccept?: (suggestion: AISuggestion) => void;
}

export function AIFieldSuggestions({ opportunityId, onAccept }: AIFieldSuggestionsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Load persisted suggestions from DB only — NEVER call the AI on mount.
  // The AI is only invoked when the user clicks the refresh button.
  const { data, isLoading, refetch } = useQuery({
    queryKey: aiSuggestionKeys.fields(opportunityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('suggestion_type', 'field_update')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AISuggestion[];
    },
    enabled: !!opportunityId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const suggestions = data ?? [];
  const loading = isLoading;

  const loadSuggestions = async () => {
    setRefreshing(true);
    try {
      // Force AI regeneration; edge function persists with context signature.
      const result = await generateFieldSuggestions(opportunityId, true);
      queryClient.setQueryData(aiSuggestionKeys.fields(opportunityId), result.suggestions || []);
    } catch (e: any) {
      console.error('Error refreshing suggestions:', e);
      toast.error('Erro ao gerar sugestões');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = async (suggestion: AISuggestion) => {
    setProcessingId(suggestion.id);
    try {
      const result = await acceptSuggestion(suggestion.id);
      
      // Update cached suggestions list
      queryClient.setQueryData<AISuggestion[]>(
        aiSuggestionKeys.fields(opportunityId),
        (prev) => (prev ?? []).filter((s) => s.id !== suggestion.id),
      );
      
      // Invalidate all related queries to refresh the UI (sidebar, kanban,
      // scoring, NRHS, dashboards) — single source of truth.
      await invalidateOpportunity(queryClient, opportunityId);
      
      const fieldLabel = getFieldLabel(suggestion.field_name || '');
      
      if (result.is_no_op) {
        toast.info(`${fieldLabel} já estava com o valor sugerido`);
      } else {
        const newValueDisplay = result.new_value_label || formatValue(suggestion.field_name || '', result.new_value);
        toast.success(`${fieldLabel} atualizado para ${newValueDisplay}!`);
      }
      
      onAccept?.(suggestion);
    } catch (error: any) {
      console.error('Error accepting suggestion:', error);
      toast.error(error.message || 'Erro ao aceitar sugestão');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      await rejectSuggestion(suggestionId);
      queryClient.setQueryData<AISuggestion[]>(
        aiSuggestionKeys.fields(opportunityId),
        (prev) => (prev ?? []).filter((s) => s.id !== suggestionId),
      );
      toast.success('Sugestão rejeitada');
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      toast.error('Erro ao rejeitar sugestão');
    } finally {
      setProcessingId(null);
    }
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      valor_previsto: 'Valor Previsto',
      prob: 'Probabilidade',
      temperature: 'Temperatura',
      close_date_prevista: 'Data de Fechamento',
      stage_id: 'Estágio'
    };
    return labels[fieldName] || fieldName;
  };

  const formatValue = (fieldName: string, value: any) => {
    if (fieldName === 'valor_previsto' && typeof value === 'number') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    if (fieldName === 'prob' && typeof value === 'number') {
      return `${value}%`;
    }
    if (fieldName === 'temperature') {
      const temps: Record<string, string> = {
        cold: 'Frio',
        warm: 'Morno',
        hot: 'Quente',
        burning: 'Fervendo'
      };
      return temps[value] || value;
    }
    if (fieldName === 'close_date_prevista' && value) {
      return formatDateBR(value);
    }
    return value?.toString() || '-';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Sugestões Inteligentes</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSuggestions}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          A IA analisou esta oportunidade e sugere as seguintes atualizações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion) => (
          <div 
            key={suggestion.id}
            className="p-4 rounded-lg border bg-card space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {getFieldLabel(suggestion.field_name || '')}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round((suggestion.confidence_score || 0) * 100)}% confiança
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatValue(suggestion.field_name || '', suggestion.current_value)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-primary">
                    {formatValue(suggestion.field_name || '', suggestion.suggested_value)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {suggestion.reasoning}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAccept(suggestion)}
                disabled={processingId === suggestion.id}
              >
                {processingId === suggestion.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(suggestion.id)}
                disabled={processingId === suggestion.id}
              >
                <X className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
