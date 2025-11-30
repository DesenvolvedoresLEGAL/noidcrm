import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { generateFieldSuggestions, acceptSuggestion, rejectSuggestion, type AISuggestion } from '@/services/crm/ai-automation';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';

interface AIFieldSuggestionsProps {
  opportunityId: string;
  onAccept?: (suggestion: AISuggestion) => void;
}

export function AIFieldSuggestions({ opportunityId, onAccept }: AIFieldSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, [opportunityId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const result = await generateFieldSuggestions(opportunityId);
      setSuggestions(result.suggestions);
    } catch (error: any) {
      console.error('Error loading suggestions:', error);
      if (error.message !== 'AI API error: 402' && error.message !== 'AI API error: 429') {
        toast.error('Erro ao carregar sugestões');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestion: AISuggestion) => {
    setProcessingId(suggestion.id);
    try {
      await acceptSuggestion(suggestion.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success('Sugestão aceita!');
      onAccept?.(suggestion);
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      toast.error('Erro ao aceitar sugestão');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      await rejectSuggestion(suggestionId);
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
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
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Sugestões Inteligentes</CardTitle>
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
