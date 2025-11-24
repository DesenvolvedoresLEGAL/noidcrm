import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, Archive, TrendingUp, Loader2 } from 'lucide-react';
import { generateCleanupSuggestions, acceptSuggestion, rejectSuggestion, type AISuggestion } from '@/services/crm/ai-automation';
import { updateOpportunityStatus } from '@/services/crm/opportunities';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function PipelineCleanupPanel() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const result = await generateCleanupSuggestions();
      setSuggestions(result.suggestions.filter(s => s.opportunity_id));
    } catch (error: any) {
      console.error('Error loading cleanup suggestions:', error);
      if (error.message !== 'AI API error: 402' && error.message !== 'AI API error: 429') {
        toast.error('Erro ao carregar sugestões de limpeza');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (suggestion: AISuggestion) => {
    if (!suggestion.opportunity_id) return;
    
    setProcessingId(suggestion.id);
    try {
      await updateOpportunityStatus(suggestion.opportunity_id, 'lost');
      await acceptSuggestion(suggestion.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success('Oportunidade arquivada');
    } catch (error) {
      console.error('Error archiving opportunity:', error);
      toast.error('Erro ao arquivar oportunidade');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReactivate = async (suggestion: AISuggestion) => {
    setProcessingId(suggestion.id);
    try {
      await rejectSuggestion(suggestion.id);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success('Marcado para reativação');
    } catch (error) {
      console.error('Error reactivating:', error);
      toast.error('Erro ao reativar');
    } finally {
      setProcessingId(null);
    }
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
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-primary" />
              <CardTitle>Limpeza de Pipeline</CardTitle>
            </div>
            <Button onClick={loadSuggestions} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Verificar
            </Button>
          </div>
          <CardDescription>
            Mantenha seu pipeline saudável
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            ✨ Seu pipeline está limpo! Nenhuma sugestão de limpeza no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-primary" />
            <CardTitle>Limpeza de Pipeline</CardTitle>
          </div>
          <Button onClick={loadSuggestions} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          {suggestions.length} oportunidade{suggestions.length !== 1 ? 's' : ''} sugerida{suggestions.length !== 1 ? 's' : ''} para análise
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion) => {
          const oppData = suggestion as any;
          const isArchive = suggestion.suggested_value === 'archive';
          
          return (
            <div 
              key={suggestion.id}
              className="p-4 rounded-lg border bg-card space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {oppData.opportunity?.title || 'Oportunidade'}
                    </span>
                    <Badge variant={isArchive ? 'destructive' : 'default'}>
                      {isArchive ? 'Arquivar' : 'Reativar'}
                    </Badge>
                    {suggestion.confidence_score && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(suggestion.confidence_score * 100)}% confiança
                      </Badge>
                    )}
                  </div>
                  {oppData.opportunity && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {oppData.opportunity.valor_previsto && (
                        <span>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(oppData.opportunity.valor_previsto)}
                        </span>
                      )}
                      {oppData.opportunity.days_since_contact && (
                        <span>{oppData.opportunity.days_since_contact}d sem contato</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {suggestion.reasoning}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isArchive ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleArchive(suggestion)}
                      disabled={processingId === suggestion.id}
                    >
                      {processingId === suggestion.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="mr-2 h-4 w-4" />
                      )}
                      Arquivar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReactivate(suggestion)}
                      disabled={processingId === suggestion.id}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Manter Ativo
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleReactivate(suggestion)}
                      disabled={processingId === suggestion.id}
                    >
                      {processingId === suggestion.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TrendingUp className="mr-2 h-4 w-4" />
                      )}
                      Reativar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchive(suggestion)}
                      disabled={processingId === suggestion.id}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar Mesmo Assim
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
