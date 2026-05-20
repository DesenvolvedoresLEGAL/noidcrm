import { useMemo, useState, useEffect } from 'react';
import { Users, UserCheck, TrendingUp, AlertTriangle, Clock, Target, ArrowRight, Plus, Star, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEntityGraph, useEntityInsights, useUpdateInsightStatus } from '@/hooks/useKnowledgeGraph';
import { useCreateActivityFromInsight } from '@/hooks/useCreateActivityFromInsight';
import { setOpportunityChampion, removeOpportunityChampion, setOpportunityDecisionMaker, removeOpportunityDecisionMaker } from '@/services/crm/knowledge-graph';
import { isDecisionMakerCargo } from '@/services/crm/decision-maker-checker';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  decision_maker: 'decide sobre',
};

const strengthColors: Record<string, string> = {
  strong: 'bg-green-500',
  medium: 'bg-yellow-500',
  weak: 'bg-red-500',
};

export function OpportunityGraphSignals({ opportunityId }: OpportunityGraphSignalsProps) {
  const { data: graph, isLoading: graphLoading, refetch: refetchGraph } = useEntityGraph('opportunity', opportunityId);
  const { data: insights, isLoading: insightsLoading } = useEntityInsights('opportunity', opportunityId);
  const updateStatus = useUpdateInsightStatus();
  const { createActivityFromInsight } = useCreateActivityFromInsight();
  const queryClient = useQueryClient();
  const [settingChampion, setSettingChampion] = useState<string | null>(null);
  const [settingDecisionMaker, setSettingDecisionMaker] = useState<string | null>(null);

  // Helper: invalidate NRHS + network caches and fire recalc edge function.
  const refreshAfterStakeholderChange = async (organizationId?: string | null) => {
    await refetchGraph();
    queryClient.invalidateQueries({ queryKey: ['opportunity-network-summary', opportunityId] });
    queryClient.invalidateQueries({ queryKey: ['nrhs'] });
    queryClient.invalidateQueries({ queryKey: ['nrhs-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
    queryClient.invalidateQueries({ queryKey: ['opportunity-detail', opportunityId] });
    // Fire-and-forget NRHS recalc so the pillar updates immediately.
    try {
      await supabase.functions.invoke('calculate-nrhs', {
        body: {
          opportunity_id: opportunityId,
          organization_id: organizationId ?? undefined,
          trigger_source: 'opportunity_network_tab',
          trigger_action: 'stakeholder_role_change',
        },
      });
      queryClient.invalidateQueries({ queryKey: ['nrhs'] });
    } catch (err) {
      console.warn('[OpportunityGraphSignals] NRHS recalc fallback:', err);
    }
  };

  // Fetch opportunity to get account_id
  const { data: opportunity } = useQuery({
    queryKey: ['opportunity-for-graph', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, account_id, organization_id')
        .eq('id', opportunityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!opportunityId,
  });

  // Fetch ALL contacts for the account directly from database
  const { data: accountContacts, refetch: refetchContacts } = useQuery({
    queryKey: ['account-contacts-for-graph', opportunity?.account_id],
    queryFn: async () => {
      if (!opportunity?.account_id) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('id, nome, cargo, account_id')
        .eq('account_id', opportunity.account_id)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!opportunity?.account_id,
  });

  const isLoading = graphLoading || insightsLoading;

  // Force refetch on mount to avoid stale cache
  useEffect(() => {
    if (opportunityId) {
      refetchGraph();
    }
  }, [opportunityId, refetchGraph]);

  // Analyze graph data
  const analysis = useMemo(() => {
    if (!graph) return null;

    const opportunityNode = graph.nodes.find(n => n.type === 'opportunity' && n.entity_id === opportunityId);

    // Resolve account id robustly: prefer the connected account node entity_id
    const nodesById = new Map(graph.nodes.map(n => [n.id, n] as const));
    const connectedAccountNode = opportunityNode
      ? graph.edges
          .map(e => {
            const otherId = e.source === opportunityNode.id ? e.target : e.target === opportunityNode.id ? e.source : null;
            return otherId ? nodesById.get(otherId) : null;
          })
          .find(n => n?.type === 'account')
      : null;

    const accountIdFromEdge = connectedAccountNode?.entity_id;
    const accountIdFromProps = opportunityNode?.properties?.account_id;
    const accountIdFromOpp = opportunity?.account_id;
    const accountId = accountIdFromEdge || accountIdFromProps || accountIdFromOpp;

    // Get contacts from graph that belong to this account
    const graphContacts = graph.nodes.filter(n => n.type === 'contact');
    const graphContactsFiltered = accountId
      ? graphContacts.filter(c => c.properties?.account_id === accountId)
      : graphContacts;

    // Merge with database contacts to ensure ALL contacts are shown
    const graphContactEntityIds = new Set(graphContactsFiltered.map(c => c.entity_id));
    
    // Create contact nodes from database for contacts not in graph
    const additionalContacts = (accountContacts || [])
      .filter(c => !graphContactEntityIds.has(c.id))
      .map(c => ({
        id: `db-${c.id}`, // Prefix to distinguish from graph nodes
        entity_id: c.id,
        type: 'contact' as const,
        label: c.nome,
        properties: {
          cargo: c.cargo,
          account_id: c.account_id,
        },
        connectivity: 0,
        activity: 0,
      }));

    // Combined contacts list
    const contacts = [...graphContactsFiltered, ...additionalContacts];
    
    const proposals = graph.nodes.filter(n => n.type === 'proposal');
    const users = graph.nodes.filter(n => n.type === 'user');
    
    // Find champion edge for THIS opportunity (target must match opportunityNode.id)
    const championEdge = opportunityNode
      ? graph.edges.find(e => e.type === 'champions' && e.target === opportunityNode.id)
      : null;
    let championContactId: string | null = null;
    let championNode: typeof contacts[0] | null = null;

    if (championEdge) {
      // Find the source node to get its entity_id
      const sourceNode = graph.nodes.find(n => n.id === championEdge.source);
      if (sourceNode) {
        championContactId = sourceNode.entity_id; // Use entity_id, not node id
        // Find matching contact by entity_id
        championNode = contacts.find(c => c.entity_id === sourceNode.entity_id) || null;
      }
    }

    // Find decision maker edge for THIS opportunity (target must match opportunityNode.id)
    const decisionMakerEdge = opportunityNode
      ? graph.edges.find(e => (e.type as string) === 'decision_maker' && e.target === opportunityNode.id)
      : null;
    let decisionMakerContactId: string | null = null;
    let decisionMakerNode: typeof contacts[0] | null = null;

    if (decisionMakerEdge) {
      const sourceNode = graph.nodes.find(n => n.id === decisionMakerEdge.source);
      if (sourceNode) {
        decisionMakerContactId = sourceNode.entity_id; // Use entity_id
        decisionMakerNode = contacts.find(c => c.entity_id === sourceNode.entity_id) || null;
      }
    }
    
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

    // Identify key decision makers from filtered contacts using unified cargo check
    const decisionMakers = contacts.filter(c => isDecisionMakerCargo(c.properties?.cargo));

    // Count only edges connected to this opportunity or its related contacts
    const relevantNodeIds = new Set([
      opportunityNode?.id,
      ...contacts.map(c => c.id),
      connectedAccountNode?.id,
    ].filter(Boolean));
    
    const relevantEdges = graph.edges.filter(e => 
      relevantNodeIds.has(e.source) || relevantNodeIds.has(e.target)
    );

    return {
      totalNodes: graph.nodes.length,
      totalEdges: relevantEdges.length,
      contacts,
      proposals,
      users,
      champion: championNode,
      championContactId,
      decisionMaker: decisionMakerNode,
      decisionMakerContactId,
      decisionMakers,
      stakeholderCoverage: coverage,
      avgStrength,
      influenceEdges,
    };
  }, [graph, opportunityId, accountContacts, opportunity]);

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
              <Badge variant="secondary" className="text-[10px] bg-yellow-500/20 text-yellow-700">
                Champion
              </Badge>
            )}
          </div>

          {/* Decision Maker (from proposal acceptance) */}
          {analysis.decisionMaker && (
            <div className="flex items-center justify-between p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{analysis.decisionMaker.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {analysis.decisionMaker.properties?.cargo || 'Aprovador de Proposta'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600">
                  Decision Maker
                </Badge>
                {/* Option to promote to Champion */}
                {analysis.decisionMakerContactId && analysis.championContactId !== analysis.decisionMakerContactId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
                    onClick={async () => {
                      try {
                        setSettingChampion(analysis.decisionMaker!.entity_id);
                        await setOpportunityChampion(opportunityId, analysis.decisionMaker!.entity_id);
                        toast.success('Decision Maker promovido a Champion!');
                        await refetchGraph();
                        queryClient.invalidateQueries({ queryKey: ['opportunity-network-summary', opportunityId] });
                      } catch (error) {
                        console.error('Error promoting to champion:', error);
                        toast.error('Erro ao promover para Champion');
                      } finally {
                        setSettingChampion(null);
                      }
                    }}
                    disabled={settingChampion === analysis.decisionMaker.entity_id}
                  >
                    {settingChampion === analysis.decisionMaker.entity_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Star className="h-3 w-3 mr-1" />
                        Promover
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Decision Makers by Position */}
          {analysis.decisionMakers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Decisores por Cargo</p>
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
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <p className="text-xs text-primary flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              {insight.suggested_action}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-6 shrink-0"
                              onClick={() => createActivityFromInsight({
                                opportunityId,
                                insight: insight as any,
                                onSuccess: () => updateStatus.mutate({ 
                                  insightId: insight.id, 
                                  status: 'acknowledged' 
                                })
                              })}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Criar Tarefa
                            </Button>
                          </div>
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
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-600 fill-current" />
              <strong>Champion:</strong> defensor interno do negócio
            </span>
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3 text-blue-600" />
              <strong>Decisor:</strong> quem aprova a compra
            </span>
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-2">
              {analysis.contacts.length > 0 ? (
                analysis.contacts.map(contact => {
                  const edge = analysis.influenceEdges.find(e => e.source === contact.id);
                  // Use entity_id for comparison since championContactId is now entity_id
                  const isChampion = analysis.championContactId === contact.entity_id;
                  const isDecisionMaker = analysis.decisionMakerContactId === contact.entity_id;
                  const isSettingThis = settingChampion === contact.entity_id;
                  const isSettingDMThis = settingDecisionMaker === contact.entity_id;
                  
                  const handleSetChampion = async () => {
                    setSettingChampion(contact.entity_id);
                    try {
                      if (isChampion) {
                        await removeOpportunityChampion(opportunityId);
                        toast.success('Champion removido');
                      } else {
                        await setOpportunityChampion(opportunityId, contact.entity_id);
                        toast.success('Champion definido com sucesso');
                      }
                      await refreshAfterStakeholderChange(opportunity?.organization_id);
                    } catch (error) {
                      console.error('Error setting champion:', error);
                      toast.error('Erro ao definir champion');
                    } finally {
                      setSettingChampion(null);
                    }
                  };

                  const handleSetDecisionMaker = async () => {
                    setSettingDecisionMaker(contact.entity_id);
                    try {
                      if (isDecisionMaker) {
                        await removeOpportunityDecisionMaker(opportunityId);
                        toast.success('Decisor removido');
                      } else {
                        await setOpportunityDecisionMaker(opportunityId, contact.entity_id);
                        toast.success('Decisor definido com sucesso');
                      }
                      await refreshAfterStakeholderChange(opportunity?.organization_id);
                    } catch (error) {
                      console.error('Error setting decision maker:', error);
                      toast.error('Erro ao definir decisor');
                    } finally {
                      setSettingDecisionMaker(null);
                    }
                  };
                  
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{contact.label}</p>
                            {isChampion && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-700">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                Champion
                              </Badge>
                            )}
                            {isDecisionMaker && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600">
                                <Target className="h-2.5 w-2.5 mr-0.5" />
                                Decisor
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {contact.properties?.cargo || 'Sem cargo'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                        <Button
                          size="sm"
                          variant={isChampion ? "secondary" : "ghost"}
                          className={cn(
                            "h-7 px-2 text-xs",
                            isChampion && "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700"
                          )}
                          onClick={handleSetChampion}
                          disabled={isSettingThis}
                          title={isChampion ? 'Remover Champion (defensor interno do negócio)' : 'Marcar como Champion (defensor interno do negócio)'}
                        >
                          {isSettingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Star className={cn("h-3.5 w-3.5", isChampion && "fill-current")} />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant={isDecisionMaker ? "secondary" : "ghost"}
                          className={cn(
                            "h-7 px-2 text-xs",
                            isDecisionMaker && "bg-blue-500/20 hover:bg-blue-500/30 text-blue-700"
                          )}
                          onClick={handleSetDecisionMaker}
                          disabled={isSettingDMThis}
                          title={isDecisionMaker ? 'Remover Decisor (quem aprova a compra)' : 'Marcar como Decisor (quem aprova a compra)'}
                        >
                          {isSettingDMThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Target className={cn("h-3.5 w-3.5", isDecisionMaker && "fill-current")} />
                          )}
                        </Button>
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
