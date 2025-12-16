import { useMemo } from 'react';
import { Users, UserCheck, TrendingUp, AlertTriangle, Clock, Target, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEntityGraph, useEntityInsights, useUpdateInsightStatus } from '@/hooks/useKnowledgeGraph';
import { cn } from '@/lib/utils';

interface OpportunityGraphSignalsProps {
  opportunityId: string;
}

const nodeTypeLabels: Record<string, string> = {
  account: 'Empresa',
  contact: 'Contato',
  opportunity: 'Oportunidade',
  proposal: 'Proposta',
  user: 'Vendedor',
  interaction: 'Interação',
};

const edgeTypeLabels: Record<string, string> = {
  works_at: 'trabalha em',
  owns: 'é responsável por',
  relates_to: 'relaciona-se com',
  influences: 'influencia',
  communicates_with: 'comunica-se com',
  champions: 'defende',
  blocks: 'bloqueia',
  participates_in: 'participa de',
};

const strengthColors: Record<string, string> = {
  strong: 'bg-green-500',
  medium: 'bg-yellow-500',
  weak: 'bg-red-500',
};

export function OpportunityGraphSignals({ opportunityId }: OpportunityGraphSignalsProps) {
  const { data: graph, isLoading: graphLoading } = useEntityGraph('opportunity', opportunityId);
  const { data: insights, isLoading: insightsLoading } = useEntityInsights('opportunity', opportunityId);
  const updateStatus = useUpdateInsightStatus();

  const isLoading = graphLoading || insightsLoading;

  // Analyze graph data
  const analysis = useMemo(() => {
    if (!graph) return null;

    const contacts = graph.nodes.filter(n => n.type === 'contact');
    const proposals = graph.nodes.filter(n => n.type === 'proposal');
    const users = graph.nodes.filter(n => n.type === 'user');

    const championEdge = graph.edges.find(e => e.type === 'champions');
    const influenceEdges = graph.edges.filter(e => e.type === 'influences');
    
    // Calculate stakeholder coverage
    const totalStakeholders = contacts.length;
    const engagedStakeholders = influenceEdges.filter(e => e.interaction_count > 0).length;
    const coverage = totalStakeholders > 0 ? (engagedStakeholders / totalStakeholders) * 100 : 0;

    // Calculate average relationship strength
    const weightedEdges = graph.edges.filter(e => e.weight > 0);
    const avgStrength = weightedEdges.length > 0
      ? weightedEdges.reduce((sum, e) => sum + e.weight, 0) / weightedEdges.length
      : 0;

    // Find champion contact
    const championNode = championEdge 
      ? graph.nodes.find(n => n.id === championEdge.source)
      : null;

    // Identify key decision makers
    const decisionMakers = contacts.filter(c => {
      const cargo = (c.properties?.cargo || '').toLowerCase();
      return cargo.includes('diretor') || cargo.includes('gerente') || 
             cargo.includes('ceo') || cargo.includes('owner') || cargo.includes('head');
    });

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      contacts,
      proposals,
      users,
      champion: championNode,
      decisionMakers,
      stakeholderCoverage: coverage,
      avgStrength,
      influenceEdges,
    };
  }, [graph]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Grafo não disponível</p>
          <p className="text-xs mt-1">Execute um build para gerar o grafo</p>
        </CardContent>
      </Card>
    );
  }

  const activeInsights = insights?.filter(i => i.status === 'active') || [];

  return (
    <div className="space-y-4">
      {/* Network Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Rede de Relacionamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{analysis.contacts.length}</p>
              <p className="text-[10px] text-muted-foreground">Stakeholders</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{analysis.proposals.length}</p>
              <p className="text-[10px] text-muted-foreground">Propostas</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{analysis.users.length}</p>
              <p className="text-[10px] text-muted-foreground">Time</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{analysis.totalEdges}</p>
              <p className="text-[10px] text-muted-foreground">Conexões</p>
            </div>
          </div>

          {/* Stakeholder Coverage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cobertura de Stakeholders</span>
              <span className="font-medium">{Math.round(analysis.stakeholderCoverage)}%</span>
            </div>
            <Progress value={analysis.stakeholderCoverage} className="h-2" />
          </div>

          {/* Relationship Strength */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Força do Relacionamento</span>
              <Badge 
                variant="outline"
                className={cn(
                  "text-[10px]",
                  analysis.avgStrength >= 0.7 && "border-green-500 text-green-600",
                  analysis.avgStrength >= 0.4 && analysis.avgStrength < 0.7 && "border-yellow-500 text-yellow-600",
                  analysis.avgStrength < 0.4 && "border-red-500 text-red-600"
                )}
              >
                {analysis.avgStrength >= 0.7 ? 'Forte' : analysis.avgStrength >= 0.4 ? 'Média' : 'Fraca'}
              </Badge>
            </div>
            <Progress 
              value={analysis.avgStrength * 100} 
              className={cn(
                "h-2",
                analysis.avgStrength >= 0.7 && "[&>div]:bg-green-500",
                analysis.avgStrength >= 0.4 && analysis.avgStrength < 0.7 && "[&>div]:bg-yellow-500",
                analysis.avgStrength < 0.4 && "[&>div]:bg-red-500"
              )}
            />
          </div>

          {/* Champion */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <UserCheck className={cn(
                "h-5 w-5",
                analysis.champion ? "text-green-500" : "text-muted-foreground"
              )} />
              <div>
                <p className="text-sm font-medium">
                  {analysis.champion ? analysis.champion.label : 'Champion não identificado'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {analysis.champion 
                    ? analysis.champion.properties?.cargo || 'Contato interno'
                    : 'Identifique quem defende sua solução'
                  }
                </p>
              </div>
            </div>
            {analysis.champion && (
              <Badge variant="secondary" className="text-[10px]">
                Champion
              </Badge>
            )}
          </div>

          {/* Decision Makers */}
          {analysis.decisionMakers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Decisores Identificados</p>
              <div className="flex flex-wrap gap-2">
                {analysis.decisionMakers.map(dm => (
                  <Badge key={dm.id} variant="outline" className="text-xs">
                    {dm.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Insights */}
      {activeInsights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Sinais de Atenção
              <Badge variant="secondary" className="ml-auto">{activeInsights.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {activeInsights.map(insight => (
                  <div 
                    key={insight.id}
                    className="p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              insight.severity === 'high' && "border-orange-500 text-orange-600",
                              insight.severity === 'critical' && "border-red-500 text-red-600",
                              insight.severity === 'medium' && "border-yellow-500 text-yellow-600",
                              insight.severity === 'low' && "border-muted-foreground"
                            )}
                          >
                            {insight.severity}
                          </Badge>
                          <span className="text-sm font-medium">{insight.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{insight.description}</p>
                        {insight.suggested_action && (
                          <p className="text-xs text-primary flex items-center gap-1 mt-2">
                            <ArrowRight className="h-3 w-3" />
                            {insight.suggested_action}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => updateStatus.mutate({ 
                          insightId: insight.id, 
                          status: 'resolved' 
                        })}
                        disabled={updateStatus.isPending}
                      >
                        Resolver
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Stakeholder List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Stakeholders Mapeados</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-2">
              {analysis.contacts.length > 0 ? (
                analysis.contacts.map(contact => {
                  const edge = analysis.influenceEdges.find(e => e.source === contact.id);
                  return (
                    <div 
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          edge?.strength === 'strong' && "bg-green-500",
                          edge?.strength === 'medium' && "bg-yellow-500",
                          (!edge || edge?.strength === 'weak') && "bg-red-500"
                        )} />
                        <div>
                          <p className="text-sm font-medium">{contact.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {contact.properties?.cargo || 'Sem cargo'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {edge && (
                          <>
                            <p className="text-xs">{edge.interaction_count} interações</p>
                            {edge.last_interaction && (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(edge.last_interaction).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum stakeholder mapeado
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
