import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Lightbulb, 
  BookOpen,
  AlertTriangle,
  Trophy,
  Loader2,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SellerMetrics {
  id: string;
  name: string;
  avatar_url?: string;
  opportunities_count: number;
  pipeline_value: number;
  won_value: number;
  activities_count: number;
  conversion_rate: number;
  goal_progress: number;
}

interface CoachingData {
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  strategies: string[];
  training_materials: string[];
  priority_actions: string[];
}

interface AICoachingPanelProps {
  teamMembers: SellerMetrics[];
  teamGoal: number;
}

export function AICoachingPanel({ teamMembers, teamGoal }: AICoachingPanelProps) {
  const [selectedSeller, setSelectedSeller] = useState<SellerMetrics | null>(null);
  const [coachingData, setCoachingData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCoaching = async (seller: SellerMetrics) => {
    setSelectedSeller(seller);
    setLoading(true);
    setCoachingData(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-team-coaching', {
        body: {
          sellerId: seller.id,
          sellerName: seller.name,
          metrics: {
            opportunities_count: seller.opportunities_count,
            pipeline_value: seller.pipeline_value,
            won_value: seller.won_value,
            activities_count: seller.activities_count,
            conversion_rate: seller.conversion_rate,
            goal_progress: seller.goal_progress,
            team_goal: teamGoal
          }
        }
      });

      if (error) throw error;
      setCoachingData(data);
    } catch (error) {
      console.error('Error fetching coaching:', error);
      toast.error('Erro ao gerar coaching');
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceStatus = (progress: number) => {
    if (progress >= 100) return { label: 'Meta Atingida', color: 'bg-green-500', icon: Trophy };
    if (progress >= 80) return { label: 'No Caminho', color: 'bg-blue-500', icon: TrendingUp };
    if (progress >= 50) return { label: 'Atenção', color: 'bg-yellow-500', icon: AlertTriangle };
    return { label: 'Crítico', color: 'bg-red-500', icon: TrendingDown };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Coaching Individual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {teamMembers.map((member) => {
              const status = getPerformanceStatus(member.goal_progress);
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSeller?.id === member.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => fetchCoaching(member)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback>
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Progress value={member.goal_progress} className="w-20 h-1.5" />
                        <span className="text-xs text-muted-foreground">
                          {member.goal_progress.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={`${status.color} text-white text-xs`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Coaching Details Panel */}
      {selectedSeller && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedSeller.avatar_url} />
                  <AvatarFallback>
                    {selectedSeller.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{selectedSeller.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Coaching personalizado via IA
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fetchCoaching(selectedSeller)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando performance...</p>
              </div>
            ) : coachingData ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                  <TabsTrigger value="strategies">Estratégias</TabsTrigger>
                  <TabsTrigger value="training">Treinamento</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Strengths */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      Pontos Fortes
                    </h4>
                    <ul className="space-y-1">
                      {coachingData.strengths.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Gaps */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      Gaps Identificados
                    </h4>
                    <ul className="space-y-1">
                      {coachingData.gaps.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-orange-500 mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-blue-600">
                      <Lightbulb className="h-4 w-4" />
                      Recomendações
                    </h4>
                    <ul className="space-y-1">
                      {coachingData.recommendations.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="strategies" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Estratégias de Abordagem
                    </h4>
                    <div className="space-y-2">
                      {coachingData.strategies.map((strategy, i) => (
                        <div 
                          key={i} 
                          className="p-3 rounded-lg bg-muted/50 border text-sm"
                        >
                          <span className="font-medium text-primary mr-2">{i + 1}.</span>
                          {strategy}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Ações Prioritárias
                    </h4>
                    <div className="space-y-2">
                      {coachingData.priority_actions.map((action, i) => (
                        <div 
                          key={i} 
                          className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm flex items-start gap-2"
                        >
                          <Badge variant="outline" className="shrink-0">
                            P{i + 1}
                          </Badge>
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="training" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Materiais Recomendados
                    </h4>
                    <div className="space-y-2">
                      {coachingData.training_materials.map((material, i) => (
                        <div 
                          key={i} 
                          className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{material}</p>
                              <p className="text-xs text-muted-foreground">
                                Clique para acessar
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Selecione um vendedor para ver o coaching</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
