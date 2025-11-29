import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Loader2,
  Eye,
  DollarSign
} from 'lucide-react';
import { 
  generateIntroduction, 
  analyzeProposal, 
  suggestPricing,
  getClientSentimentAnalysis,
  ProposalAnalysis,
  PricingSuggestion,
  ClientSentiment
} from '@/services/crm/proposal-ai';
import { toast } from 'sonner';

interface AIProposalCopilotProps {
  proposalId?: string;
  proposalData?: any;
  opportunityData?: any;
  accountData?: any;
  onIntroductionGenerated?: (intro: string) => void;
  onPriceSuggestion?: (price: number) => void;
}

export function AIProposalCopilot({
  proposalId,
  proposalData,
  opportunityData,
  accountData,
  onIntroductionGenerated,
  onPriceSuggestion,
}: AIProposalCopilotProps) {
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  
  const [analysis, setAnalysis] = useState<ProposalAnalysis | null>(null);
  const [pricing, setPricing] = useState<PricingSuggestion | null>(null);
  const [sentiment, setSentiment] = useState<ClientSentiment | null>(null);

  const handleGenerateIntro = async () => {
    if (!accountData) {
      toast.error('Dados da conta não disponíveis');
      return;
    }

    setGeneratingIntro(true);
    try {
      const intro = await generateIntroduction({
        accountName: accountData.razao_social,
        segment: accountData.segmento,
        product: opportunityData?.produto,
        value: proposalData?.value,
        clientName: proposalData?.client_name || accountData.nome_fantasia,
      });

      onIntroductionGenerated?.(intro);
      toast.success('✨ Introdução gerada com sucesso!');
    } catch (error) {
      console.error('Error generating intro:', error);
      toast.error('Erro ao gerar introdução');
    } finally {
      setGeneratingIntro(false);
    }
  };

  const handleAnalyze = async () => {
    if (!proposalId || !proposalData) {
      toast.error('Salve a proposta antes de analisar');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeProposal(proposalId, proposalData);
      setAnalysis(result);
      
      if (result.issues.length === 0) {
        toast.success('✅ Proposta sem problemas detectados!');
      } else {
        const errorCount = result.issues.filter(i => i.severity === 'error').length;
        if (errorCount > 0) {
          toast.warning(`⚠️ ${errorCount} problema(s) crítico(s) detectado(s)`);
        }
      }
    } catch (error) {
      console.error('Error analyzing:', error);
      toast.error('Erro ao analisar proposta');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSuggestPricing = async () => {
    if (!accountData?.id || !opportunityData?.id) {
      toast.error('Dados insuficientes para sugestão de preço');
      return;
    }

    setLoadingPricing(true);
    try {
      const result = await suggestPricing(
        accountData.id,
        opportunityData.id,
        proposalData?.value
      );
      setPricing(result);
      toast.success('💡 Sugestão de preço calculada!');
    } catch (error) {
      console.error('Error suggesting pricing:', error);
      toast.error('Erro ao sugerir preço');
    } finally {
      setLoadingPricing(false);
    }
  };

  const handleAnalyzeSentiment = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta primeiro');
      return;
    }

    setLoadingSentiment(true);
    try {
      const result = await getClientSentimentAnalysis(proposalId);
      setSentiment(result);
      toast.success('📊 Análise de sentimento concluída!');
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      toast.error('Erro ao analisar sentimento');
    } finally {
      setLoadingSentiment(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning': return <Info className="h-4 w-4 text-yellow-600" />;
      default: return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'default';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-50 border-green-200';
      case 'concerned': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Copilot para Propostas
          </CardTitle>
          <CardDescription>
            Assistente inteligente para otimizar suas propostas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleGenerateIntro}
              disabled={generatingIntro || !accountData}
              className="justify-start"
            >
              {generatingIntro ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Gerar Introdução
            </Button>

            <Button
              variant="outline"
              onClick={handleAnalyze}
              disabled={analyzing || !proposalId}
              className="justify-start"
            >
              {analyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Revisar Proposta
            </Button>

            <Button
              variant="outline"
              onClick={handleSuggestPricing}
              disabled={loadingPricing || !accountData}
              className="justify-start"
            >
              {loadingPricing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="mr-2 h-4 w-4" />
              )}
              Sugerir Preço
            </Button>

            <Button
              variant="outline"
              onClick={handleAnalyzeSentiment}
              disabled={loadingSentiment || !proposalId}
              className="justify-start"
            >
              {loadingSentiment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Analisar Visualizações
            </Button>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <Alert className={analysis.score >= 80 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
              <AlertDescription>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Score de Qualidade</span>
                    <Badge variant={analysis.score >= 80 ? 'default' : 'secondary'}>
                      {analysis.score}/100
                    </Badge>
                  </div>
                  <p className="text-sm">{analysis.summary}</p>
                  
                  {analysis.issues.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <span className="text-sm font-medium">Problemas Detectados:</span>
                      {analysis.issues.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <p className="font-medium">{issue.message}</p>
                            <p className="text-muted-foreground text-xs mt-1">
                              💡 {issue.suggestion}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Pricing Suggestions */}
          {pricing && (
            <Alert className="bg-blue-50 border-blue-200">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <span className="font-medium">Sugestão de Preço</span>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                    <div>
                      <span className="text-muted-foreground text-xs">Mínimo</span>
                      <p className="font-medium">R$ {pricing.minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Recomendado</span>
                      <p className="font-medium text-blue-600">R$ {pricing.recommendedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Máximo</span>
                      <p className="font-medium">R$ {pricing.maxPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{pricing.reasoning}</p>
                  {pricing.conversionRate > 0 && (
                    <p className="text-xs">
                      Taxa de conversão: <span className="font-medium">{pricing.conversionRate.toFixed(1)}%</span>
                    </p>
                  )}
                  {onPriceSuggestion && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPriceSuggestion(pricing.recommendedPrice)}
                      className="mt-2"
                    >
                      Aplicar Preço Recomendado
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Sentiment Analysis */}
          {sentiment && (
            <Alert className={getSentimentColor(sentiment.sentiment)}>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Análise de Visualizações</span>
                    <Badge variant={sentiment.sentiment === 'positive' ? 'default' : 'secondary'}>
                      {sentiment.sentiment === 'positive' ? 'Positivo' : sentiment.sentiment === 'concerned' ? 'Atenção' : 'Neutro'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                    <div>
                      <span className="text-muted-foreground text-xs">Visualizações</span>
                      <p className="font-medium">{sentiment.viewCount}x</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Tempo Médio</span>
                      <p className="font-medium">{Math.round(sentiment.avgViewDuration)}s</p>
                    </div>
                  </div>
                  <div className="space-y-1 mt-3">
                    {sentiment.insights.map((insight, idx) => (
                      <p key={idx} className="text-xs">• {insight}</p>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
