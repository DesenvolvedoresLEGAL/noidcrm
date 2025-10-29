import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/services/roleplay/sessions';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Video, PlayCircle, ChevronLeft, Award } from 'lucide-react';

export default function SessionSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['roleplay-session', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId
  });

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['session-insights', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_insights')
        .select('*')
        .eq('session_id', sessionId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!sessionId
  });

  const { data: recommendations, isLoading: loadingRecs } = useQuery({
    queryKey: ['video-recommendations', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_recommendations')
        .select(`
          *,
          video_library(*)
        `)
        .eq('session_id', sessionId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!sessionId
  });

  if (loadingSession || loadingInsights || loadingRecs) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Processando avaliação...</p>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p>Sessão não encontrada</p>
          <Button onClick={() => navigate('/app/roleplay')} className="mt-4">
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  const scoreData = session.scores_json as any;
  const passed = session.passed;
  const overallScore = session.score_overall || 0;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              Resultado do Treino
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Avaliação detalhada de performance
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Result Header */}
          <div className="text-center space-y-4">
          <div className={`inline-flex p-4 rounded-full ${
            passed ? 'bg-success/10' : 'bg-destructive/10'
          }`}>
            {passed ? (
              <CheckCircle2 className="h-12 w-12 text-success" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {passed ? 'Treino Concluído!' : 'Continue Praticando'}
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-5xl font-bold">{overallScore.toFixed(1)}</span>
            <span className="text-2xl text-muted-foreground">/10</span>
          </div>
          <Badge variant={passed ? 'default' : 'destructive'} className="text-sm px-4 py-1">
            {passed ? '✓ Aprovado' : '✗ Não Passou'}
          </Badge>
        </div>

        {/* Dimensions */}
        {scoreData?.dimensions && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Avaliação por Dimensão</h2>
            <div className="space-y-4">
              {scoreData.dimensions.map((dim: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dim.key}</span>
                    <span className={`text-lg font-bold ${
                      dim.score >= 8 ? 'text-success' : dim.score >= 6 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {dim.score.toFixed(1)}/10
                    </span>
                  </div>
                  {dim.feedback && (
                    <p className="text-sm text-muted-foreground pl-4 border-l-2">
                      {dim.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Insights */}
        {insights && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6 bg-success/5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-success" />
                <h3 className="font-semibold">Pontos Fortes</h3>
              </div>
              <ul className="space-y-2 text-sm">
                {(insights.strengths as string[] || []).map((strength, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6 bg-warning/5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-5 w-5 text-warning" />
                <h3 className="font-semibold">Áreas de Melhoria</h3>
              </div>
              <ul className="space-y-2 text-sm">
                {(insights.weaknesses as string[] || []).map((weakness, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-warning shrink-0 mt-0.5">→</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* Recommended Videos */}
        {recommendations && recommendations.video_ids && (recommendations.video_ids as string[]).length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Vídeos Recomendados</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {recommendations.reasoning}
            </p>
            <div className="grid gap-3">
              {(recommendations.video_ids as string[]).map((videoId: string, idx: number) => (
                <Card key={idx} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PlayCircle className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Vídeo #{idx + 1}</p>
                        <p className="text-xs text-muted-foreground">ID: {videoId.substring(0, 8)}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Assistir
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/app/roleplay/sessions')}
          >
            Ver Histórico
          </Button>
          <Button
            className="flex-1"
            onClick={() => navigate('/app/roleplay/new')}
          >
            Iniciar Outro Treino
          </Button>
        </div>
        </div>
      </div>
    </Layout>
  );
}