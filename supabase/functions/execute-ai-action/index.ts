import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Confidence thresholds
const CONFIDENCE_AUTO_EXECUTE = 0.9;
const CONFIDENCE_EXECUTE_NOTIFY = 0.7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      organization_id,
      action_type,
      entity_type,
      entity_id,
      confidence_score,
      decision_data,
      context_data,
      target_user_id, // Who to notify
    } = await req.json();

    if (!organization_id || !action_type || confidence_score === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let status = 'pending';
    let executed_at = null;

    // Determine action based on confidence
    if (confidence_score >= CONFIDENCE_AUTO_EXECUTE) {
      // High confidence - auto execute
      status = 'auto_executed';
      executed_at = new Date().toISOString();
      
      console.log(`[execute-ai-action] Auto-executing action with confidence ${confidence_score}`);
      
    } else if (confidence_score >= CONFIDENCE_EXECUTE_NOTIFY) {
      // Medium confidence - execute and notify
      status = 'executed_notified';
      executed_at = new Date().toISOString();
      
      // Create notification for user
      if (target_user_id) {
        await supabase.from('notifications').insert({
          organization_id,
          user_id: target_user_id,
          type: 'ai_action',
          title: `IA executou: ${getActionLabel(action_type)}`,
          message: `Uma ação foi executada automaticamente pela IA com ${Math.round(confidence_score * 100)}% de confiança. Revise se necessário.`,
          metadata: {
            action_type,
            entity_type,
            entity_id,
            confidence_score,
            decision_data,
          },
        });
      }
      
      console.log(`[execute-ai-action] Executed with notification, confidence ${confidence_score}`);
      
    } else {
      // Low confidence - request approval
      status = 'awaiting_approval';
      
      // Create high-priority notification
      if (target_user_id) {
        await supabase.from('notifications').insert({
          organization_id,
          user_id: target_user_id,
          type: 'ai_approval_needed',
          title: `IA precisa de aprovação: ${getActionLabel(action_type)}`,
          message: `Uma decisão da IA requer sua aprovação (confiança: ${Math.round(confidence_score * 100)}%). Acesse AI Operations para revisar.`,
          metadata: {
            action_type,
            entity_type,
            entity_id,
            confidence_score,
            decision_data,
          },
        });
      }
      
      console.log(`[execute-ai-action] Awaiting approval, confidence ${confidence_score}`);
    }

    // Record the action
    const { data: aiAction, error: actionError } = await supabase
      .from('ai_actions')
      .insert({
        organization_id,
        action_type,
        entity_type,
        entity_id,
        confidence_score,
        status,
        decision_data,
        context_data: context_data || {},
        executed_at,
      })
      .select()
      .single();

    if (actionError) {
      console.error('[execute-ai-action] Error recording action:', actionError);
      throw actionError;
    }

    // If auto-executed or executed_notified, perform the actual action
    if (status === 'auto_executed' || status === 'executed_notified') {
      await performAction(supabase, {
        action_type,
        entity_type,
        entity_id,
        decision_data,
        organization_id,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action_id: aiAction.id,
        status,
        executed: status !== 'awaiting_approval',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[execute-ai-action] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getActionLabel(type: string): string {
  const labels: Record<string, string> = {
    lead_routing: 'Roteamento de Lead',
    stage_change: 'Mudança de Etapa',
    follow_up: 'Follow-up',
    email_send: 'Envio de Email',
    task_create: 'Criação de Tarefa',
    score_update: 'Atualização de Score',
  };
  return labels[type] || type;
}

async function performAction(supabase: any, params: {
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  decision_data: any;
  organization_id: string;
}) {
  const { action_type, entity_type, entity_id, decision_data, organization_id } = params;

  try {
    switch (action_type) {
      case 'stage_change':
        if (entity_type === 'opportunity' && entity_id && decision_data.new_stage_id) {
          await supabase
            .from('opportunities')
            .update({ stage_id: decision_data.new_stage_id })
            .eq('id', entity_id);
        }
        break;

      case 'task_create':
        if (decision_data.title && decision_data.owner_user_id) {
          await supabase.from('activities').insert({
            organization_id,
            owner_user_id: decision_data.owner_user_id,
            type: 'task',
            title: decision_data.title,
            description: decision_data.description || 'Tarefa criada automaticamente pela IA',
            status: 'pending',
            scheduled_date: decision_data.scheduled_date || new Date().toISOString(),
            opportunity_id: decision_data.opportunity_id,
            account_id: decision_data.account_id,
            ai_generated: true,
          });
        }
        break;

      case 'score_update':
        if (entity_type === 'account' && entity_id) {
          const updates: any = {};
          if (decision_data.fit_score !== undefined) updates.fit_score = decision_data.fit_score;
          if (decision_data.intent_score !== undefined) updates.intent_score = decision_data.intent_score;
          if (decision_data.lead_grade !== undefined) updates.lead_grade = decision_data.lead_grade;
          updates.score_updated_at = new Date().toISOString();
          
          await supabase
            .from('accounts')
            .update(updates)
            .eq('id', entity_id);
        }
        break;

      case 'follow_up':
        // Create a follow-up activity
        if (decision_data.owner_user_id && decision_data.opportunity_id) {
          await supabase.from('activities').insert({
            organization_id,
            owner_user_id: decision_data.owner_user_id,
            type: 'follow_up',
            title: decision_data.title || 'Follow-up automático',
            description: decision_data.description || 'Follow-up sugerido pela IA',
            status: 'pending',
            scheduled_date: decision_data.scheduled_date || new Date().toISOString(),
            opportunity_id: decision_data.opportunity_id,
            ai_generated: true,
          });
        }
        break;

      default:
        console.log(`[execute-ai-action] No handler for action type: ${action_type}`);
    }
  } catch (error) {
    console.error(`[execute-ai-action] Error performing action ${action_type}:`, error);
    // Don't throw - we still want to record that we tried
  }
}
