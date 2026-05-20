import { supabase } from '@/integrations/supabase/client';
import { logStakeholderEvent } from './timeline-logger';
import { isDecisionMakerCargo } from './decision-maker-checker';

export interface GraphNode {
  id: string;
  entity_id: string;
  type: 'account' | 'contact' | 'opportunity' | 'interaction' | 'proposal' | 'contract' | 'user';
  label: string;
  properties: Record<string, any>;
  connectivity: number;
  activity: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'works_at' | 'owns' | 'relates_to' | 'influences' | 'communicates_with' | 'champions' | 'blocks' | 'participates_in' | 'converts_to';
  weight: number;
  strength: 'weak' | 'medium' | 'strong';
  interaction_count: number;
  last_interaction: string | null;
}

export interface EntityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphInsight {
  id: string;
  entity_type: string;
  entity_id: string;
  insight_type: 'missing_champion' | 'missing_decision_maker' | 'silent_stakeholder' | 'isolated_deal' | 'weak_relationship' | 'network_gap' | 'high_centrality' | 'engagement_decay';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggested_action: string | null;
  action_type: string | null;
  evidence: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface GraphBuild {
  id: string;
  status: string;
  build_type: string;
  nodes_created: number;
  edges_created: number;
  insights_generated: number;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

// Fetch graph for a specific entity
export async function getEntityGraph(
  entityType: string,
  entityId: string,
  depth: number = 2
): Promise<EntityGraph> {
  const { data, error } = await supabase.rpc('get_entity_graph', {
    p_organization_id: await getOrgId(),
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_depth: depth
  });

  if (error) throw error;
  
  // Parse the JSON response
  const graphData = data as unknown as EntityGraph;
  return graphData || { nodes: [], edges: [] };
}

// Fetch insights for a specific entity
export async function getEntityInsights(
  entityType: string,
  entityId: string
): Promise<GraphInsight[]> {
  const { data, error } = await supabase
    .from('graph_insights')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'active')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as GraphInsight[];
}

// Fetch all active insights for organization
export async function getOrganizationInsights(
  status: string = 'active',
  limit: number = 50
): Promise<GraphInsight[]> {
  const { data, error } = await supabase
    .from('graph_insights')
    .select('*')
    .eq('status', status)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as GraphInsight[];
}

// Update insight status
export async function updateInsightStatus(
  insightId: string,
  status: 'acknowledged' | 'resolved' | 'dismissed'
): Promise<void> {
  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
  
  if (status === 'acknowledged') {
    updates.acknowledged_at = new Date().toISOString();
  } else if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('graph_insights')
    .update(updates)
    .eq('id', insightId);

  if (error) throw error;
}

// Fetch graph builds history
export async function getGraphBuilds(limit: number = 10): Promise<GraphBuild[]> {
  const { data, error } = await supabase
    .from('graph_builds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as GraphBuild[];
}

// Trigger manual graph build
export async function triggerGraphBuild(buildType: string = 'full'): Promise<string> {
  const orgId = await getOrgId();
  
  const { data, error } = await supabase.functions.invoke('build-knowledge-graph', {
    body: { organization_id: orgId, build_type: buildType }
  });

  if (error) throw error;
  return data?.results?.[0]?.build_id || null;
}

// Get graph statistics
export async function getGraphStats(): Promise<{
  total_nodes: number;
  total_edges: number;
  nodes_by_type: Record<string, number>;
  edges_by_type: Record<string, number>;
  active_insights: number;
  last_build: GraphBuild | null;
}> {
  const [nodesResult, edgesResult, insightsResult, buildsResult] = await Promise.all([
    supabase.from('graph_nodes').select('node_type', { count: 'exact' }),
    supabase.from('graph_edges').select('edge_type', { count: 'exact' }),
    supabase.from('graph_insights').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('graph_builds').select('*').order('created_at', { ascending: false }).limit(1)
  ]);

  // Count by type
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};

  if (nodesResult.data) {
    for (const node of nodesResult.data) {
      const type = (node as any).node_type;
      nodesByType[type] = (nodesByType[type] || 0) + 1;
    }
  }

  if (edgesResult.data) {
    for (const edge of edgesResult.data) {
      const type = (edge as any).edge_type;
      edgesByType[type] = (edgesByType[type] || 0) + 1;
    }
  }

  return {
    total_nodes: nodesResult.count || 0,
    total_edges: edgesResult.count || 0,
    nodes_by_type: nodesByType,
    edges_by_type: edgesByType,
    active_insights: insightsResult.count || 0,
    last_build: (buildsResult.data?.[0] as GraphBuild) || null
  };
}

// Get opportunity network summary
export async function getOpportunityNetworkSummary(opportunityId: string): Promise<{
  stakeholder_count: number;
  has_champion: boolean;
  has_decision_maker: boolean;
  relationship_strength: 'weak' | 'medium' | 'strong';
  days_since_last_contact: number | null;
  gaps: string[];
}> {
  const graph = await getEntityGraph('opportunity', opportunityId, 2);
  const insights = await getEntityInsights('opportunity', opportunityId);

  // Resolve account id robustly: prefer the connected account node entity_id
  const opportunityNode = graph.nodes.find(n => n.type === 'opportunity' && n.entity_id === opportunityId);
  const nodesById = new Map(graph.nodes.map(n => [n.id, n] as const));
  const connectedAccountNode = opportunityNode
    ? graph.edges
        .map(e => {
          const otherId = e.source === opportunityNode.id ? e.target : e.target === opportunityNode.id ? e.source : null;
          return otherId ? nodesById.get(otherId) : null;
        })
        .find(n => n?.type === 'account')
    : null;

  const accountId = connectedAccountNode?.entity_id || opportunityNode?.properties?.account_id;

  // Filter contacts to only those belonging to this opportunity's account
  const allContactNodes = graph.nodes.filter(n => n.type === 'contact');
  const contactNodes = accountId
    ? allContactNodes.filter(c => c.properties?.account_id === accountId)
    : allContactNodes;

  // Find champion edge for THIS opportunity (target must match opportunityNode.id)
  const championEdge = opportunityNode
    ? graph.edges.find(e => e.type === 'champions' && e.target === opportunityNode.id)
    : null;

  const hasChampion = !!championEdge;
  
  // Calculate average relationship strength
  const influenceEdges = graph.edges.filter(e => e.type === 'influences' || e.type === 'communicates_with');
  const avgWeight = influenceEdges.length > 0
    ? influenceEdges.reduce((sum, e) => sum + e.weight, 0) / influenceEdges.length
    : 0;

  // Find most recent interaction
  const lastInteraction = influenceEdges
    .filter(e => e.last_interaction)
    .sort((a, b) => new Date(b.last_interaction!).getTime() - new Date(a.last_interaction!).getTime())[0];
  
  const daysSinceContact = lastInteraction?.last_interaction
    ? Math.floor((Date.now() - new Date(lastInteraction.last_interaction).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Check for decision maker using unified logic:
  // 1. First check for explicit decision_maker edge in graph
  const decisionMakerEdge = opportunityNode
    ? graph.edges.find(e => (e.type as string) === 'decision_maker' && e.target === opportunityNode.id)
    : null;
  
  // 2. Then check deal_participants for decision_maker role
  let hasDealParticipantDecisionMaker = false;
  if (!decisionMakerEdge) {
    const { data: dealParticipants } = await supabase
      .from('deal_participants')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .eq('role', 'decision_maker')
      .limit(1);
    hasDealParticipantDecisionMaker = (dealParticipants?.length || 0) > 0;
  }
  
  // 3. Finally check contacts by cargo using unified function
  const hasContactDecisionMaker = contactNodes.some(c => isDecisionMakerCargo(c.properties?.cargo));
  
  const hasDecisionMaker = !!decisionMakerEdge || hasDealParticipantDecisionMaker || hasContactDecisionMaker;

  return {
    stakeholder_count: contactNodes.length,
    has_champion: hasChampion,
    has_decision_maker: hasDecisionMaker,
    relationship_strength: avgWeight >= 0.7 ? 'strong' : avgWeight >= 0.4 ? 'medium' : 'weak',
    days_since_last_contact: daysSinceContact,
    gaps: insights.map(i => i.title)
  };
}

// Set or update champion for an opportunity
export async function setOpportunityChampion(
  opportunityId: string,
  contactId: string
): Promise<void> {
  const orgId = await getOrgId();
  
  // Get or create the opportunity node
  let oppNodeId: string;
  const { data: existingOppNode } = await supabase
    .from('graph_nodes')
    .select('id')
    .eq('entity_id', opportunityId)
    .eq('node_type', 'opportunity')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existingOppNode) {
    oppNodeId = existingOppNode.id;
  } else {
    // Create opportunity node
    const { data: opp } = await supabase
      .from('opportunities')
      .select('title, account_id')
      .eq('id', opportunityId)
      .single();
    
    const { data: newOppNode, error: oppNodeError } = await supabase
      .from('graph_nodes')
      .insert({
        organization_id: orgId,
        node_type: 'opportunity',
        entity_id: opportunityId,
        label: opp?.title || 'Oportunidade',
        properties: { account_id: opp?.account_id },
      })
      .select('id')
      .single();
    
    if (oppNodeError) throw oppNodeError;
    oppNodeId = newOppNode.id;
  }

  // Get or create the contact node
  let contactNodeId: string;
  const { data: existingContactNode } = await supabase
    .from('graph_nodes')
    .select('id')
    .eq('entity_id', contactId)
    .eq('node_type', 'contact')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existingContactNode) {
    contactNodeId = existingContactNode.id;
  } else {
    // Create contact node
    const { data: contact } = await supabase
      .from('contacts')
      .select('nome, cargo, account_id')
      .eq('id', contactId)
      .single();
    
    const { data: newContactNode, error: contactNodeError } = await supabase
      .from('graph_nodes')
      .insert({
        organization_id: orgId,
        node_type: 'contact',
        entity_id: contactId,
        label: contact?.nome || 'Contato',
        properties: { cargo: contact?.cargo, account_id: contact?.account_id },
      })
      .select('id')
      .single();
    
    if (contactNodeError) throw contactNodeError;
    contactNodeId = newContactNode.id;
  }

  // Remove existing champion edges for this opportunity
  await supabase
    .from('graph_edges')
    .delete()
    .eq('organization_id', orgId)
    .eq('target_node_id', oppNodeId)
    .eq('edge_type', 'champions');

  // Create champion edge
  const { error: edgeError } = await supabase
    .from('graph_edges')
    .insert({
      organization_id: orgId,
      source_node_id: contactNodeId,
      target_node_id: oppNodeId,
      edge_type: 'champions' as any,
      weight: 1.0,
      strength: 'strong',
      interaction_count: 0
    });

  if (edgeError) throw edgeError;
  
  // Log to timeline
  const { data: contact } = await supabase
    .from('contacts')
    .select('nome, cargo')
    .eq('id', contactId)
    .single();
  
  await logStakeholderEvent(opportunityId, 'champion_set', contact?.nome, contact?.cargo);
  
  console.log('Champion edge created successfully:', { contactNodeId, oppNodeId, contactId });
}

// Set or update decision maker for an opportunity
export async function setOpportunityDecisionMaker(
  opportunityId: string,
  contactId: string
): Promise<void> {
  const orgId = await getOrgId();
  
  // Get or create the opportunity node
  let oppNodeId: string;
  const { data: existingOppNode } = await supabase
    .from('graph_nodes')
    .select('id')
    .eq('entity_id', opportunityId)
    .eq('node_type', 'opportunity')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existingOppNode) {
    oppNodeId = existingOppNode.id;
  } else {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('title, account_id')
      .eq('id', opportunityId)
      .single();
    
    const { data: newOppNode, error: oppNodeError } = await supabase
      .from('graph_nodes')
      .insert({
        organization_id: orgId,
        node_type: 'opportunity',
        entity_id: opportunityId,
        label: opp?.title || 'Oportunidade',
        properties: { account_id: opp?.account_id },
      })
      .select('id')
      .single();
    
    if (oppNodeError) throw oppNodeError;
    oppNodeId = newOppNode.id;
  }

  // Get or create the contact node
  let contactNodeId: string;
  const { data: existingContactNode } = await supabase
    .from('graph_nodes')
    .select('id')
    .eq('entity_id', contactId)
    .eq('node_type', 'contact')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existingContactNode) {
    contactNodeId = existingContactNode.id;
  } else {
    const { data: contact } = await supabase
      .from('contacts')
      .select('nome, cargo, account_id')
      .eq('id', contactId)
      .single();
    
    const { data: newContactNode, error: contactNodeError } = await supabase
      .from('graph_nodes')
      .insert({
        organization_id: orgId,
        node_type: 'contact',
        entity_id: contactId,
        label: contact?.nome || 'Contato',
        properties: { cargo: contact?.cargo, account_id: contact?.account_id },
      })
      .select('id')
      .single();
    
    if (contactNodeError) throw contactNodeError;
    contactNodeId = newContactNode.id;
  }

  // Remove existing decision_maker edges for this opportunity
  await supabase
    .from('graph_edges')
    .delete()
    .eq('organization_id', orgId)
    .eq('target_node_id', oppNodeId)
    .eq('edge_type', 'decision_maker');

  // Create decision_maker edge
  const { error } = await supabase
    .from('graph_edges')
    .insert({
      organization_id: orgId,
      source_node_id: contactNodeId,
      target_node_id: oppNodeId,
      edge_type: 'decision_maker' as any,
      weight: 1.0,
      strength: 'strong',
      interaction_count: 0
    });

  if (error) throw error;

  await supabase
    .from('graph_insights')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('entity_type', 'opportunity')
    .eq('entity_id', opportunityId)
    .eq('insight_type', 'missing_decision_maker')
    .eq('status', 'active');
  
  // Log to timeline
  const { data: contact } = await supabase
    .from('contacts')
    .select('nome, cargo')
    .eq('id', contactId)
    .single();
  
  await logStakeholderEvent(opportunityId, 'decision_maker_set', contact?.nome, contact?.cargo);
}

// Remove decision maker from an opportunity
export async function removeOpportunityDecisionMaker(
  opportunityId: string
): Promise<void> {
  const orgId = await getOrgId();
  
  // Get the opportunity node first
  const { data: oppNode } = await supabase
    .from('graph_nodes')
    .select('id')
    .eq('entity_id', opportunityId)
    .eq('node_type', 'opportunity')
    .eq('organization_id', orgId)
    .single();

  if (!oppNode) return;

  const { error } = await supabase
    .from('graph_edges')
    .delete()
    .eq('organization_id', orgId)
    .eq('target_node_id', oppNode.id)
    .eq('edge_type', 'decision_maker');

  if (error) throw error;
  
  // Log to timeline
  await logStakeholderEvent(opportunityId, 'decision_maker_removed');
}

// Remove champion from an opportunity
export async function removeOpportunityChampion(
  opportunityId: string
): Promise<void> {
  const orgId = await getOrgId();
  
  // Get the opportunity node first
  const { data: oppNode } = await supabase
    .from('graph_nodes')
    .select('id')
    .eq('entity_id', opportunityId)
    .eq('node_type', 'opportunity')
    .eq('organization_id', orgId)
    .single();

  if (!oppNode) return;

  const { error } = await supabase
    .from('graph_edges')
    .delete()
    .eq('organization_id', orgId)
    .eq('target_node_id', oppNode.id)
    .eq('edge_type', 'champions');

  if (error) throw error;
  
  // Log to timeline
  await logStakeholderEvent(opportunityId, 'champion_removed');
}

// Helper to get org ID
async function getOrgId(): Promise<string> {
  const { data } = await supabase.rpc('get_user_organization_id');
  if (!data) throw new Error('Organization not found');
  return data;
}
