import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Humanoid organization constants
const HUMANOID_ORG_ID = '774d7d78-8257-4891-aac7-718039b80049';
const PRE_VENDAS_PIPELINE_ID = '774d7d78-8257-4891-aac7-718039b80049-sales-1';
const TRIAL_EXPIRED_STAGE_ID = 'trial-expired-plg-stage';

interface TrialExpiredRequest {
  opportunity_id: string;
  plg_organization_id: string;
  plg_score: number;
}

type PlgClassification = 'hot' | 'warm' | 'cold';

interface ClassificationConfig {
  classification: PlgClassification;
  tagName: string;
  tagColor: string;
  taskTitle: string;
  taskDescription: string;
  taskPriority: 'high' | 'medium' | 'low';
  taskDueDays: number;
}

/**
 * Classify based on PLG Score
 * ≥ 75 → 🔥 HOT
 * 45-74 → ⚠️ WARM
 * < 45 → ❄️ COLD
 */
function getClassification(plgScore: number): ClassificationConfig {
  if (plgScore >= 75) {
    return {
      classification: 'hot',
      tagName: 'trial_expired_hot',
      tagColor: '#EF4444',
      taskTitle: '🔥 Contato consultivo - Trial expirou com alto engajamento',
      taskDescription: `O trial expirou mas o PLG Score (${plgScore}) indica alto engajamento. 
        
O cliente extraiu valor real do produto. Abordagem sugerida:
- Diagnóstico consultivo
- Entender barreiras à conversão
- CTA: "Você extraiu valor real, faltou só formalizar"`,
      taskPriority: 'high',
      taskDueDays: 1
    };
  } else if (plgScore >= 45) {
    return {
      classification: 'warm',
      tagName: 'trial_expired_warm',
      tagColor: '#F59E0B',
      taskTitle: '⚠️ Enviar conteúdo educativo - Trial expirado',
      taskDescription: `O trial expirou com PLG Score médio (${plgScore}). 
        
Ações recomendadas:
- Enviar casos de uso relevantes
- Convidar para call de descoberta
- Avaliar extensão de trial se regra permitir`,
      taskPriority: 'medium',
      taskDueDays: 3
    };
  } else {
    return {
      classification: 'cold',
      tagName: 'trial_expired_cold',
      tagColor: '#3B82F6',
      taskTitle: '❄️ Adicionar ao nurturing passivo - Trial expirado',
      taskDescription: `O trial expirou com PLG Score baixo (${plgScore}). 
        
O cliente não engajou significativamente. Ações:
- Nurturing passivo
- Remarketing
- Considerar reentrada futura via PLG ou campanhas`,
      taskPriority: 'low',
      taskDueDays: 7
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[trial-expired-automation] Processing trial expired automation...');
    
    const payload: TrialExpiredRequest = await req.json();
    console.log('[trial-expired-automation] Received payload:', JSON.stringify(payload, null, 2));

    const { opportunity_id, plg_organization_id, plg_score } = payload;

    // Validate required fields
    if (!opportunity_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required field: opportunity_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get opportunity details
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('id, title, plg_score, owner_user_id, account_id, stage_id, pipeline_id')
      .eq('id', opportunity_id)
      .maybeSingle();

    if (oppError || !opportunity) {
      console.error('[trial-expired-automation] Error fetching opportunity:', oppError);
      return new Response(
        JSON.stringify({ success: false, error: 'Opportunity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use PLG score from opportunity or payload
    const effectivePlgScore = opportunity.plg_score || plg_score || 0;
    console.log(`[trial-expired-automation] PLG Score: ${effectivePlgScore}`);

    // Get classification based on PLG Score
    const config = getClassification(effectivePlgScore);
    console.log(`[trial-expired-automation] Classification: ${config.classification}`);

    // =======================================================
    // 1. UPDATE OPPORTUNITY
    // =======================================================
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        stage_id: TRIAL_EXPIRED_STAGE_ID,
        plg_classification: config.classification,
        trial_status: 'expired',
        status: 'open', // GUARDRAIL: NUNCA marcar como won/lost automaticamente
        updated_at: new Date().toISOString()
      })
      .eq('id', opportunity_id);

    if (updateError) {
      console.error('[trial-expired-automation] Error updating opportunity:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update opportunity', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[trial-expired-automation] Opportunity updated to Trial Expirado (PLG) stage');

    // =======================================================
    // 2. APPLY TAG
    // =======================================================
    // Find the tag ID
    const { data: tag, error: tagFindError } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', HUMANOID_ORG_ID)
      .eq('name', config.tagName)
      .maybeSingle();

    if (tag && !tagFindError) {
      // Remove any existing trial_expired tags first
      await supabase
        .from('opportunity_tags')
        .delete()
        .eq('opportunity_id', opportunity_id)
        .in('tag_id', (
          await supabase
            .from('tags')
            .select('id')
            .eq('organization_id', HUMANOID_ORG_ID)
            .like('name', 'trial_expired_%')
        ).data?.map((t: any) => t.id) || []);

      // Apply the new tag
      const { error: tagError } = await supabase
        .from('opportunity_tags')
        .upsert({
          opportunity_id,
          tag_id: tag.id
        }, {
          onConflict: 'opportunity_id,tag_id'
        });

      if (tagError) {
        console.warn('[trial-expired-automation] Failed to apply tag:', tagError);
      } else {
        console.log(`[trial-expired-automation] Applied tag: ${config.tagName}`);
      }
    }

    // =======================================================
    // 3. CREATE TASK (PLAYBOOK EXECUTION)
    // =======================================================
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + config.taskDueDays);

    // Get a default owner for the task
    const { data: defaultOwner } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', HUMANOID_ORG_ID)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    const taskOwnerId = opportunity.owner_user_id || defaultOwner?.user_id;

    if (taskOwnerId) {
      const { data: newTask, error: taskError } = await supabase
        .from('activities')
        .insert({
          organization_id: HUMANOID_ORG_ID,
          opportunity_id,
          account_id: opportunity.account_id,
          owner_user_id: taskOwnerId,
          type: 'task',
          title: config.taskTitle,
          description: config.taskDescription,
          status: 'pending',
          scheduled_date: dueDate.toISOString(),
          is_automated: true,
          ai_generated: true
        })
        .select('id')
        .single();

      if (taskError) {
        console.warn('[trial-expired-automation] Failed to create task:', taskError);
      } else {
        console.log(`[trial-expired-automation] Created task: ${newTask?.id}`);
      }
    } else {
      console.warn('[trial-expired-automation] No owner found for task creation');
    }

    // =======================================================
    // 4. AUDIT LOG
    // =======================================================
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        action: 'trial_expired_processed',
        entity_type: 'opportunity',
        entity_id: opportunity_id,
        metadata: {
          event: 'trial_expired',
          origin: 'system',
          plg_score: effectivePlgScore,
          classification: config.classification,
          stage_moved_to: 'Trial Expirado (PLG)',
          stage_id: TRIAL_EXPIRED_STAGE_ID,
          tag_applied: config.tagName,
          task_created: !!taskOwnerId,
          task_priority: config.taskPriority,
          task_due_days: config.taskDueDays,
          timestamp: new Date().toISOString(),
          guardrails: {
            status_preserved: 'open',
            never_auto_won: true,
            never_auto_lost: true,
            allows_manual_qualification: true
          }
        }
      });

    if (auditError) {
      console.warn('[trial-expired-automation] Failed to create audit log:', auditError);
    }

    console.log('[trial-expired-automation] Automation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          opportunity_id,
          plg_score: effectivePlgScore,
          classification: config.classification,
          stage_id: TRIAL_EXPIRED_STAGE_ID,
          tag_applied: config.tagName,
          task_created: !!taskOwnerId,
          task_priority: config.taskPriority
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[trial-expired-automation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
