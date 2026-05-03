// Sprint Scoring 1.4 — process pending NRHS recalc queue items.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueRow {
  id: string;
  organization_id: string;
  opportunity_id: string;
  account_id: string | null;
  trigger_source: string;
  trigger_action: string;
}

const BATCH = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  try {
    let orgScope: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body && typeof body.organization_id === 'string') orgScope = body.organization_id;
      } catch { /* ignore */ }
    }

    let q = supabase
      .from('nrhs_recalc_queue')
      .select('id, organization_id, opportunity_id, account_id, trigger_source, trigger_action')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (orgScope) q = q.eq('organization_id', orgScope);

    const { data: pending, error: pendingErr } = await q;
    if (pendingErr) throw pendingErr;

    const rows = (pending ?? []) as QueueRow[];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ids = rows.map((r) => r.id);
    await supabase.from('nrhs_recalc_queue').update({ status: 'processing' }).in('id', ids);

    const byOpp = new Map<string, QueueRow[]>();
    for (const r of rows) {
      const list = byOpp.get(r.opportunity_id) ?? [];
      list.push(r);
      byOpp.set(r.opportunity_id, list);
    }

    let processed = 0, failed = 0, skipped = 0;
    for (const [oppId, group] of byOpp.entries()) {
      const primary = group[0];
      const dupes = group.slice(1).map((g) => g.id);
      try {
        const { error } = await supabase.functions.invoke('calculate-nrhs', {
          body: {
            opportunity_id: oppId,
            organization_id: primary.organization_id,
            trigger_source: primary.trigger_source,
            trigger_action: primary.trigger_action,
          },
        });
        if (error) throw error;
        await supabase.from('nrhs_recalc_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', primary.id);
        if (dupes.length > 0) {
          await supabase.from('nrhs_recalc_queue')
            .update({ status: 'skipped', processed_at: new Date().toISOString(), error_message: 'deduped within cycle' })
            .in('id', dupes);
          skipped += dupes.length;
        }
        processed += 1;
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        await supabase.from('nrhs_recalc_queue')
          .update({ status: 'failed', processed_at: new Date().toISOString(), error_message: msg })
          .in('id', group.map((g) => g.id));
        failed += group.length;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, failed, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
