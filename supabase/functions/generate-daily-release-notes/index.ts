import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[generate-daily-release-notes] Starting daily release notes generation...');

    // Buscar mudanças pendentes (não processadas)
    const { data: pendingChanges, error: pendingError } = await supabaseClient
      .from('pending_release_changes')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true });

    if (pendingError) {
      console.error('[generate-daily-release-notes] Error fetching pending changes:', pendingError);
      throw pendingError;
    }

    console.log(`[generate-daily-release-notes] Found ${pendingChanges?.length || 0} pending changes`);

    // Se não há mudanças pendentes, não criar release note
    if (!pendingChanges || pendingChanges.length === 0) {
      console.log('[generate-daily-release-notes] No pending changes, skipping release note creation');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending changes to process',
          created: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar última versão
    const { data: lastRelease, error: lastError } = await supabaseClient
      .from('release_notes')
      .select('version')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastError && lastError.code !== 'PGRST116') {
      console.error('[generate-daily-release-notes] Error fetching last version:', lastError);
    }

    // Calcular próxima versão (incrementar minor)
    let nextVersion = '1.0.0';
    if (lastRelease?.version) {
      const parts = lastRelease.version.split('.').map(Number);
      // Increment minor version
      parts[1] = (parts[1] || 0) + 1;
      parts[2] = 0; // Reset patch
      nextVersion = parts.join('.');
    }

    console.log(`[generate-daily-release-notes] Next version: ${nextVersion}`);

    // Formatar mudanças para o formato esperado
    const changes = pendingChanges.map(change => ({
      type: change.change_type,
      description: change.description
    }));

    // Determinar se é major release (tem breaking changes ou feature muito grande)
    const isMajor = pendingChanges.some(c => 
      c.metadata?.is_major === true || 
      c.description.toLowerCase().includes('breaking')
    );

    // Gerar título baseado nas mudanças
    const featureCount = changes.filter(c => c.type === 'feature').length;
    const fixCount = changes.filter(c => c.type === 'fix').length;
    const improvementCount = changes.filter(c => c.type === 'improvement').length;
    
    let title = 'Atualizações do Sistema';
    if (featureCount > 0 && fixCount === 0) {
      title = `${featureCount} Nova${featureCount > 1 ? 's' : ''} Feature${featureCount > 1 ? 's' : ''}`;
    } else if (fixCount > 0 && featureCount === 0) {
      title = `${fixCount} Correç${fixCount > 1 ? 'ões' : 'ão'}`;
    } else if (featureCount > 0 || fixCount > 0 || improvementCount > 0) {
      const parts = [];
      if (featureCount > 0) parts.push(`${featureCount} feature${featureCount > 1 ? 's' : ''}`);
      if (fixCount > 0) parts.push(`${fixCount} fix${fixCount > 1 ? 'es' : ''}`);
      if (improvementCount > 0) parts.push(`${improvementCount} melhoria${improvementCount > 1 ? 's' : ''}`);
      title = parts.join(' + ');
    }

    // Criar release note
    const { data: newRelease, error: createError } = await supabaseClient
      .from('release_notes')
      .insert({
        version: nextVersion,
        title: title,
        description: `Release automático com ${pendingChanges.length} alterações`,
        release_date: new Date().toISOString().split('T')[0],
        is_major: isMajor,
        changes: changes
      })
      .select()
      .single();

    if (createError) {
      console.error('[generate-daily-release-notes] Error creating release note:', createError);
      throw createError;
    }

    console.log(`[generate-daily-release-notes] Created release note: ${newRelease.version}`);

    // Marcar mudanças como processadas
    const changeIds = pendingChanges.map(c => c.id);
    const { error: updateError } = await supabaseClient
      .from('pending_release_changes')
      .update({ 
        processed_at: new Date().toISOString(),
        release_note_id: newRelease.id
      })
      .in('id', changeIds);

    if (updateError) {
      console.error('[generate-daily-release-notes] Error updating pending changes:', updateError);
    }

    console.log(`[generate-daily-release-notes] Marked ${changeIds.length} changes as processed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Created release ${nextVersion} with ${pendingChanges.length} changes`,
        created: true,
        version: nextVersion,
        changesProcessed: pendingChanges.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-daily-release-notes] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});