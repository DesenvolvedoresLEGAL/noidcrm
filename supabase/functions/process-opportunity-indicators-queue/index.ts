// Sprint Scoring 1.3 — Queue processor
// Picks up to 50 pending items, dedupes per opportunity_id, calls
// calculate-opportunity-indicators for each, marks completed/failed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: pending, error: pErr } = await supabase
      .from('opportunity_indicators_recalc_queue')
      .select('id, opportunity_id, organization_id, account_id, trigger_source, trigger_action')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (pErr) throw pErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dedupe: keep first occurrence per opportunity_id; mark duplicates as skipped
    const seen = new Set<string>();
    const toProcess: typeof pending = [];
    const toSkip: string[] = [];
    for (const row of pending) {
      if (seen.has(row.opportunity_id)) { toSkip.push(row.id); continue; }
      seen.add(row.opportunity_id);
      toProcess.push(row);
    }

    if (toSkip.length) {
      await supabase.from('opportunity_indicators_recalc_queue')
        .update({ status: 'skipped', processed_at: new Date().toISOString() })
        .in('id', toSkip);
    }

    // Mark as processing
    await supabase.from('opportunity_indicators_recalc_queue')
      .update({ status: 'processing' })
      .in('id', toProcess.map((r) => r.id));

    const results = await Promise.allSettled(
      toProcess.map((row) =>
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-opportunity-indicators`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            opportunity_id: row.opportunity_id,
            organization_id: row.organization_id,
            trigger_source: row.trigger_source,
            trigger_action: row.trigger_action,
          }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
          return r.json();
        })
      )
    );

    const updates = await Promise.allSettled(
      results.map((res, i) => {
        const row = toProcess[i];
        if (res.status === 'fulfilled') {
          return supabase.from('opportunity_indicators_recalc_queue')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', row.id);
        }
        return supabase.from('opportunity_indicators_recalc_queue')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            error_message: String((res as PromiseRejectedResult).reason).slice(0, 500),
          })
          .eq('id', row.id);
      })
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;

    return new Response(JSON.stringify({
      processed: results.length,
      ok,
      failed,
      skipped: toSkip.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('process-opportunity-indicators-queue error', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
