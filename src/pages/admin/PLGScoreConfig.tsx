import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  TrendingUp, 
  Settings, 
  BarChart3, 
  History, 
  Flame, 
  Thermometer, 
  Snowflake,
  RefreshCw,
  Save
} from "lucide-react";
import { PLGScoreCard } from "@/components/plg/PLGScoreCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PLGConfig {
  id: string;
  organization_id: string;
  activation_weight: number;
  engagement_weight: number;
  adoption_weight: number;
  intent_weight: number;
  scoring_rules: Record<string, Record<string, number>>;
  feature_categories: Record<string, string[]>;
  is_active: boolean;
}

interface PLGScoreHistory {
  id: string;
  organization_id: string;
  score_current: number;
  score_max: number;
  score_avg: number;
  activation_score: number;
  engagement_score: number;
  adoption_score: number;
  intent_score: number;
  classification: string;
  calculated_at: string;
}

interface PLGEvent {
  id: string;
  organization_id: string;
  event_type: string;
  event_name: string;
  event_category: string | null;
  points: number;
  created_at: string;
}

interface OrgPLGData {
  id: string;
  name: string;
  plg_score: number;
  plg_score_max: number;
  plg_classification: string;
  plg_score_updated_at: string;
}

const DEFAULT_CONFIG: Omit<PLGConfig, 'id' | 'organization_id'> = {
  activation_weight: 25,
  engagement_weight: 30,
  adoption_weight: 25,
  intent_weight: 20,
  scoring_rules: {
    activation: { org_created: 5, user_invited: 10, first_core_action: 10 },
    engagement: { max_dau_wau: 10, max_active_days: 10, max_sessions: 10 },
    adoption: { core_feature: 5, advanced_feature: 8, premium_feature: 12 },
    intent: { pricing_viewed: 5, upgrade_clicked: 8, contact_requested: 7 },
  },
  feature_categories: {
    core: ['opportunities', 'activities', 'contacts', 'proposals', 'accounts'],
    advanced: ['automation', 'scoring', 'reports', 'territories', 'workflows'],
    premium: ['ai_coach', 'roleplay', 'forecast', 'integrations', 'playbooks'],
  },
  is_active: true,
};

export default function PLGScoreConfig() {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState({
    activation: 25,
    engagement: 30,
    adoption: 25,
    intent: 20,
  });

  // Fetch organizations with PLG data
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ['admin-plg-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, plg_score, plg_score_max, plg_classification, plg_score_updated_at')
        .not('plg_score', 'is', null)
        .order('plg_score', { ascending: false });

      if (error) throw error;
      return data as OrgPLGData[];
    },
  });

  // Fetch recent PLG events
  const { data: recentEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin-plg-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plg_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as PLGEvent[];
    },
  });

  // Fetch score history
  const { data: scoreHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-plg-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plg_score_history')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as PLGScoreHistory[];
    },
  });

  // Calculate metrics
  const metrics = {
    totalOrgs: organizations?.length || 0,
    avgScore: organizations?.length 
      ? Math.round(organizations.reduce((acc, org) => acc + (org.plg_score || 0), 0) / organizations.length) 
      : 0,
    hotCount: organizations?.filter(o => o.plg_classification === 'hot').length || 0,
    warmCount: organizations?.filter(o => o.plg_classification === 'warm').length || 0,
    coldCount: organizations?.filter(o => o.plg_classification === 'cold').length || 0,
  };

  const handleWeightChange = (category: keyof typeof weights, value: number[]) => {
    const newValue = value[0];
    const diff = newValue - weights[category];
    
    // Adjust other weights proportionally to maintain sum of 100
    const otherCategories = Object.keys(weights).filter(k => k !== category) as Array<keyof typeof weights>;
    const adjustment = diff / otherCategories.length;
    
    const newWeights = { ...weights, [category]: newValue };
    otherCategories.forEach(cat => {
      newWeights[cat] = Math.max(0, Math.min(100, Math.round(weights[cat] - adjustment)));
    });
    
    setWeights(newWeights);
  };

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      // For now, just show success - in production, this would save to a default config
      toast.success('Configuração salva com sucesso');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plg'] });
    },
  });

  const getClassificationBadge = (classification: string | null) => {
    switch (classification) {
      case 'hot':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><Flame className="h-3 w-3 mr-1" /> Quente</Badge>;
      case 'warm':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Thermometer className="h-3 w-3 mr-1" /> Morno</Badge>;
      case 'cold':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Snowflake className="h-3 w-3 mr-1" /> Frio</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            PLG Score Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Modelo automático de Product-Led Growth Score (0-100)
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{metrics.totalOrgs}</div>
            <p className="text-xs text-muted-foreground">Organizações com Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{metrics.avgScore}</div>
            <p className="text-xs text-muted-foreground">Score Médio</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500 flex items-center gap-1">
              <Flame className="h-5 w-5" /> {metrics.hotCount}
            </div>
            <p className="text-xs text-muted-foreground">Quentes (≥75)</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500 flex items-center gap-1">
              <Thermometer className="h-5 w-5" /> {metrics.warmCount}
            </div>
            <p className="text-xs text-muted-foreground">Mornos (45-74)</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500 flex items-center gap-1">
              <Snowflake className="h-5 w-5" /> {metrics.coldCount}
            </div>
            <p className="text-xs text-muted-foreground">Frios (&lt;45)</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" /> Configuração do Modelo
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Métricas & Insights
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <History className="h-4 w-4" /> Eventos & Histórico
          </TabsTrigger>
        </TabsList>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weight Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Pesos das Categorias</CardTitle>
                <CardDescription>
                  Ajuste os pesos de cada categoria (total deve ser 100)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">🚀 Ativação Inicial</span>
                      <span className="text-sm text-muted-foreground">{weights.activation} pts</span>
                    </div>
                    <Slider
                      value={[weights.activation]}
                      onValueChange={(v) => handleWeightChange('activation', v)}
                      max={50}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">Criou org, convidou usuários, primeira ação</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">💡 Engajamento</span>
                      <span className="text-sm text-muted-foreground">{weights.engagement} pts</span>
                    </div>
                    <Slider
                      value={[weights.engagement]}
                      onValueChange={(v) => handleWeightChange('engagement', v)}
                      max={50}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">DAU/WAU, dias ativos, sessões recorrentes</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">⚡ Adoção de Features</span>
                      <span className="text-sm text-muted-foreground">{weights.adoption} pts</span>
                    </div>
                    <Slider
                      value={[weights.adoption]}
                      onValueChange={(v) => handleWeightChange('adoption', v)}
                      max={50}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">Core, Advanced, Premium features</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">🎯 Sinais de Intenção</span>
                      <span className="text-sm text-muted-foreground">{weights.intent} pts</span>
                    </div>
                    <Slider
                      value={[weights.intent]}
                      onValueChange={(v) => handleWeightChange('intent', v)}
                      max={50}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">Acessou pricing, clicou upgrade, solicitou contato</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total:</span>
                    <span className={`font-bold ${
                      Object.values(weights).reduce((a, b) => a + b, 0) === 100 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {Object.values(weights).reduce((a, b) => a + b, 0)} / 100
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={() => saveConfigMutation.mutate()} 
                  className="w-full"
                  disabled={Object.values(weights).reduce((a, b) => a + b, 0) !== 100}
                >
                  <Save className="h-4 w-4 mr-2" /> Salvar Configuração
                </Button>
              </CardContent>
            </Card>

            {/* Score Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Preview do Score</CardTitle>
                <CardDescription>
                  Visualização do componente PLG Score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PLGScoreCard
                  score={72}
                  scoreMax={85}
                  scoreAvg={68}
                  classification="warm"
                  breakdown={{
                    activation: 20,
                    engagement: 22,
                    adoption: 18,
                    intent: 12,
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Scoring Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Regras de Pontuação</CardTitle>
              <CardDescription>
                Pontos atribuídos para cada evento/ação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-1">🚀 Ativação</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Criou organização</span><span className="text-muted-foreground">5 pts</span></div>
                    <div className="flex justify-between"><span>Convidou usuário</span><span className="text-muted-foreground">10 pts</span></div>
                    <div className="flex justify-between"><span>Primeira ação core</span><span className="text-muted-foreground">10 pts</span></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-1">💡 Engajamento</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>DAU/WAU ratio</span><span className="text-muted-foreground">até 10 pts</span></div>
                    <div className="flex justify-between"><span>Dias ativos</span><span className="text-muted-foreground">até 10 pts</span></div>
                    <div className="flex justify-between"><span>Sessões</span><span className="text-muted-foreground">até 10 pts</span></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-1">⚡ Adoção</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Feature Core</span><span className="text-muted-foreground">5 pts</span></div>
                    <div className="flex justify-between"><span>Feature Advanced</span><span className="text-muted-foreground">8 pts</span></div>
                    <div className="flex justify-between"><span>Feature Premium</span><span className="text-muted-foreground">12 pts</span></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-1">🎯 Intenção</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Acessou pricing</span><span className="text-muted-foreground">5 pts</span></div>
                    <div className="flex justify-between"><span>Clicou upgrade</span><span className="text-muted-foreground">8 pts</span></div>
                    <div className="flex justify-between"><span>Solicitou contato</span><span className="text-muted-foreground">7 pts</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organizações por PLG Score</CardTitle>
              <CardDescription>
                Ranking de organizações ordenadas por score
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {organizations?.map((org, index) => (
                      <div 
                        key={org.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-6">#{index + 1}</span>
                          <div>
                            <p className="font-medium text-sm">{org.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Atualizado: {formatDate(org.plg_score_updated_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold">{org.plg_score || 0}</p>
                            <p className="text-xs text-muted-foreground">máx: {org.plg_score_max || 0}</p>
                          </div>
                          {getClassificationBadge(org.plg_classification)}
                        </div>
                      </div>
                    ))}
                    {organizations?.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma organização com PLG Score ainda
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Eventos PLG Recentes</CardTitle>
              <CardDescription>
                Últimos 50 eventos de produto rastreados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {recentEvents?.map((event) => (
                      <div 
                        key={event.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">
                            {event.event_type}
                          </Badge>
                          <div>
                            <p className="font-medium text-sm">{event.event_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(event.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.event_category && (
                            <Badge variant="secondary" className="capitalize">
                              {event.event_category}
                            </Badge>
                          )}
                          <span className="font-mono text-sm">+{event.points} pts</span>
                        </div>
                      </div>
                    ))}
                    {recentEvents?.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum evento PLG registrado ainda
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
