// Sprint Scoring 1.1 — process pending lead-score recalculation queue items.
// Invoked by pg_cron each minute, and also on-demand by the frontend after
// account edits to flush quickly. Idempotent and dedupes by account per cycle.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface QueueRow {
  id: string;
  organization_id: string;
  account_id: string;
  trigger_source: string;
}

const BATCH = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  try {
    // Allow optional scoping by organization_id from caller (frontend flush).
    let orgScope: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body && typeof body.organization_id === 'string') {
          orgScope = body.organization_id;
        }
      } catch {
        // empty body is fine
      }
    }

    // Pull a batch of pending rows.
    let q = supabase
      .from('lead_score_recalc_queue')
      .select('id, organization_id, account_id, trigger_source')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (orgScope) q = q.eq('organization_id', orgScope);
    const { data: pending, error: pendingErr } = await q;
    if (pendingErr) throw pendingErr;

    const rows: QueueRow[] = (pending ?? []) as QueueRow[];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark them as processing immediately to avoid double work.
    const ids = rows.map((r) => r.id);
    await supabase
      .from('lead_score_recalc_queue')
      .update({ status: 'processing' })
      .in('id', ids);

    // Dedupe by account: each account is recalculated once this cycle.
    const byAccount = new Map<string, QueueRow[]>();
    for (const r of rows) {
      const list = byAccount.get(r.account_id) ?? [];
      list.push(r);
      byAccount.set(r.account_id, list);
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const [accountId, group] of byAccount.entries()) {
      const primary = group[0];
      const dupes = group.slice(1).map((g) => g.id);
      try {
        const { error: invokeErr } = await supabase.functions.invoke(
          'calculate-account-scores',
          { body: { accountId } },
        );
        if (invokeErr) throw invokeErr;
        await supabase
          .from('lead_score_recalc_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', primary.id);
        if (dupes.length > 0) {
          await supabase
            .from('lead_score_recalc_queue')
            .update({
              status: 'skipped',
              processed_at: new Date().toISOString(),
              error_message: 'deduped within cycle',
            })
            .in('id', dupes);
          skipped += dupes.length;
        }
        processed += 1;
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        await supabase
          .from('lead_score_recalc_queue')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            error_message: msg,
          })
          .in('id', [primary.id, ...dupes]);
        failed += group.length;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, failed, skipped, batch: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
