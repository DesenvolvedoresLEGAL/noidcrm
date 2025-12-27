// Unified Decision Maker Checker
// Single source of truth for checking if opportunity has a decision maker

import { supabase } from '@/integrations/supabase/client';

export interface DecisionMakerResult {
  hasDecisionMaker: boolean;
  source: 'graph_edge' | 'deal_participant' | 'contact_cargo' | null;
  contactId: string | null;
  contactName: string | null;
  contactCargo: string | null;
}

// Cargos that indicate decision making authority
const DECISION_MAKER_CARGOS = [
  'diretor',
  'gerente',
  'ceo',
  'owner',
  'sócio',
  'presidente',
  'head',
  'c-level',
  'vp',
  'vice-presidente',
  'superintendente',
];

export function isDecisionMakerCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const cargoLower = cargo.toLowerCase();
  return DECISION_MAKER_CARGOS.some(dm => cargoLower.includes(dm));
}

/**
 * Check if an opportunity has a decision maker identified
 * This function checks multiple sources in priority order:
 * 1. Graph edge with type 'decision_maker' (explicit assignment)
 * 2. Deal participant with role 'decision_maker' 
 * 3. Contact with decision-maker cargo
 */
export async function checkDecisionMaker(
  opportunityId: string,
  accountId?: string | null
): Promise<DecisionMakerResult> {
  const noResult: DecisionMakerResult = {
    hasDecisionMaker: false,
    source: null,
    contactId: null,
    contactName: null,
    contactCargo: null,
  };

  try {
    // 1. Check graph edge for explicit decision_maker assignment
    const { data: graphNode } = await supabase
      .from('graph_nodes')
      .select('id')
      .eq('entity_id', opportunityId)
      .eq('node_type', 'opportunity')
      .maybeSingle();

    if (graphNode) {
      const { data: decisionMakerEdge } = await supabase
        .from('graph_edges')
        .select(`
          id,
          source_node_id,
          graph_nodes!graph_edges_source_node_id_fkey(entity_id, label, properties)
        `)
        .eq('target_node_id', graphNode.id)
        .eq('edge_type', 'decision_maker')
        .maybeSingle();

      if (decisionMakerEdge) {
        const sourceNode = (decisionMakerEdge as any).graph_nodes;
        return {
          hasDecisionMaker: true,
          source: 'graph_edge',
          contactId: sourceNode?.entity_id || null,
          contactName: sourceNode?.label || null,
          contactCargo: sourceNode?.properties?.cargo || null,
        };
      }
    }

    // 2. Check deal_participants for decision_maker role
    const { data: dealParticipants } = await supabase
      .from('deal_participants')
      .select('id, user_id, role')
      .eq('opportunity_id', opportunityId)
      .eq('role', 'decision_maker');

    if (dealParticipants && dealParticipants.length > 0) {
      return {
        hasDecisionMaker: true,
        source: 'deal_participant',
        contactId: null, // deal_participants uses user_id, not contact_id
        contactName: null,
        contactCargo: null,
      };
    }

    // 3. Check contacts by cargo (needs account_id)
    let resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('account_id')
        .eq('id', opportunityId)
        .single();
      resolvedAccountId = opp?.account_id;
    }

    if (resolvedAccountId) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, nome, cargo')
        .eq('account_id', resolvedAccountId);

      const decisionMakerContact = contacts?.find(c => isDecisionMakerCargo(c.cargo));
      
      if (decisionMakerContact) {
        return {
          hasDecisionMaker: true,
          source: 'contact_cargo',
          contactId: decisionMakerContact.id,
          contactName: decisionMakerContact.nome,
          contactCargo: decisionMakerContact.cargo,
        };
      }
    }

    return noResult;
  } catch (error) {
    console.error('Error checking decision maker:', error);
    return noResult;
  }
}

/**
 * Synchronous check for decision maker using pre-fetched data
 * Used by NRHS calculator and other places that already have the data
 */
export function checkDecisionMakerSync(
  contacts: Array<{ cargo?: string | null }>,
  dealParticipants: Array<{ role?: string | null }>
): boolean {
  // Check deal participants first (explicit assignment)
  if (dealParticipants.some(p => p.role === 'decision_maker')) {
    return true;
  }
  
  // Check contacts by cargo
  return contacts.some(c => isDecisionMakerCargo(c.cargo));
}
