import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

interface Payload {
  organization_id?: string;
  pipeline_id?: string;
  period_start?: string;
  period_end?: string;
  seller_id?: string | null;
}

function brTodayISO(): string {
  // YYYY-MM-DD em America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

function monthRangeFromBRDate(isoDate: string): { start: string; end: string } {
  // isoDate = YYYY-MM-DD
  const [y, m] = isoDate.split('-').map(Number);
  const start = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth: aceitar service role (authorization header) ou x-internal-secret
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
  const authHeader = req.headers.get("authorization");
  if (!authHeader && (!internalSecret || !expectedSecret || internalSecret !== expectedSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: Payload = {};
  try {
    if (req.method !== 'GET') {
      const text = await req.text();
      if (text) payload = JSON.parse(text);
    }
  } catch (_) {
    payload = {};
  }

  const todayBR = brTodayISO();
  const defaultRange = monthRangeFromBRDate(todayBR);
  const periodStart = payload.period_start || defaultRange.start;
  const periodEnd = payload.period_end || defaultRange.end;

  // Cria log inicial
  const { data: logRow } = await supabase
    .from('forecast_snapshot_job_logs')
    .insert({
      organization_id: payload.organization_id ?? null,
      pipeline_id: payload.pipeline_id ?? null,
      status: 'running',
      metadata: { payload, period_start: periodStart, period_end: periodEnd, snapshot_date: todayBR },
    })
    .select('id')
    .single();

  const logId = logRow?.id;

  let attempted = 0;
  let created = 0;
  let failed = 0;
  const errors: any[] = [];

  async function runOne(orgId: string, pipelineId: string, sellerId: string | null) {
    attempted++;
    try {
      const { error } = await supabase.rpc('create_forecast_daily_snapshot_v2', {
        p_organization_id: orgId,
        p_pipeline_id: pipelineId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_seller_id: sellerId,
        p_snapshot_date: todayBR,
      });
      if (error) throw error;
      created++;
    } catch (e: any) {
      failed++;
      errors.push({ orgId, pipelineId, sellerId, message: e?.message || String(e) });
      console.error('[snapshot] failed', { orgId, pipelineId, sellerId, error: e?.message });
    }
  }

  try {
    // Modo manual com escopo completo
    if (payload.organization_id && payload.pipeline_id) {
      await runOne(payload.organization_id, payload.pipeline_id, payload.seller_id ?? null);
    } else {
      // Rotina geral: buscar orgs alvo
      let orgsQuery = supabase.from('organizations').select('id');
      if (payload.organization_id) orgsQuery = orgsQuery.eq('id', payload.organization_id);
      const { data: orgs, error: orgErr } = await orgsQuery;
      if (orgErr) throw orgErr;

      for (const org of orgs || []) {
        try {
          // Sprint F2.10 — resolve pipeline oficial de vendas (1 por org)
          const { data: resolved, error: resolveErr } = await supabase.rpc(
            'get_forecast_sales_pipeline_v2',
            { p_organization_id: org.id },
          );
          if (resolveErr) throw resolveErr;
          const salesPipelineId = (resolved as any)?.pipeline_id as string | null;

          if (!salesPipelineId) {
            console.warn('[snapshot] skipped_no_sales_pipeline', { orgId: org.id });
            errors.push({ orgId: org.id, status: 'skipped_no_sales_pipeline' });
            continue;
          }

          if (payload.pipeline_id && payload.pipeline_id !== salesPipelineId) {
            console.warn('[snapshot] requested pipeline is not the sales pipeline; skipping', {
              orgId: org.id,
              requested: payload.pipeline_id,
              sales: salesPipelineId,
            });
            continue;
          }

          // Snapshot global
          await runOne(org.id, salesPipelineId, null);

          // Snapshot por vendedor com oportunidades no período (apenas pipeline de vendas)
          try {
            const { data: sellers } = await supabase
              .from('opportunities')
              .select('user_id')
              .eq('organization_id', org.id)
              .eq('pipeline_id', salesPipelineId)
              .is('deleted_at', null)
              .not('user_id', 'is', null);
            const uniqueSellers = Array.from(new Set((sellers || []).map((s: any) => s.user_id).filter(Boolean)));
            for (const sellerId of uniqueSellers) {
              await runOne(org.id, salesPipelineId, sellerId as string);
            }
          } catch (e: any) {
            console.error('[snapshot] sellers fetch failed', { orgId: org.id, pipelineId: salesPipelineId, error: e?.message });
          }
        } catch (e: any) {
          console.error('[snapshot] org failed', { orgId: org.id, error: e?.message });
          errors.push({ orgId: org.id, message: e?.message || String(e) });
        }
      }

  } catch (e: any) {
    console.error('[snapshot] fatal', e);
    if (logId) {
      await supabase
        .from('forecast_snapshot_job_logs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          snapshots_attempted: attempted,
          snapshots_created: created,
          snapshots_failed: failed,
          error_message: e?.message || String(e),
          metadata: { errors: errors.slice(0, 50) },
        })
        .eq('id', logId);
    }
    return new Response(JSON.stringify({ ok: false, attempted, created, failed, error: e?.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const finalStatus = failed === 0 ? 'completed' : (created > 0 ? 'completed_with_errors' : 'failed');

  if (logId) {
    await supabase
      .from('forecast_snapshot_job_logs')
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        snapshots_attempted: attempted,
        snapshots_created: created,
        snapshots_failed: failed,
        metadata: { errors: errors.slice(0, 50) },
      })
      .eq('id', logId);
  }

  return new Response(JSON.stringify({ ok: true, status: finalStatus, attempted, created, failed }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
