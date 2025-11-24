import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getStageProgressionSuggestions,
  acceptStageProgression,
  rejectStageProgression,
  StageProgressionSuggestion
} from '@/services/crm/sequences-ai';

export function AIStageProgressionCard() {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<StageProgressionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const data = await getStageProgressionSuggestions();
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestionId: string, suggestedStageId: string) => {
    setProcessingId(suggestionId);
    try {
      await acceptStageProgression(suggestionId, suggestedStageId);
      toast({
        title: 'Sucesso',
        description: 'Oportunidade movida para o próximo estágio',
      });
      await loadSuggestions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao mover oportunidade',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      await rejectStageProgression(suggestionId);
      await loadSuggestions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar sugestão',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Progressão Inteligente de Pipeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma sugestão de avanço de estágio no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Progressão Inteligente de Pipeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">
                      Confiança: {Math.round(suggestion.confidence_score * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">{suggestion.reasoning}</p>
                  <p className="text-xs text-muted-foreground">
                    Sugestão: Mover para próximo estágio
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAccept(suggestion.id, suggestion.suggested_stage_id)}
                  disabled={processingId === suggestion.id}
                  className="flex-1"
                >
                  {processingId === suggestion.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(suggestion.id)}
                  disabled={processingId === suggestion.id}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}