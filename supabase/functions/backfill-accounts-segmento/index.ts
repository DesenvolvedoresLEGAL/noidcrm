// Backfill assíncrono de Segmento para contas com CNPJ sem CNAE.
// Para cada conta elegível: chama lookup-cnpj (com cache OpenCNPJ→BrasilAPI),
// salva CNAE e deriva o segmento via fn_cnae_to_segmento.
//
// Trigger: chamado pelo cliente (admin) ou via cron. Processa em lotes pequenos
// para respeitar rate limit da OpenCNPJ.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BackfillResult {
  processed: number;
  updated: number;
  failed: number;
  remaining: number;
  errors: Array<{ account_id: string; cnpj: string; error: string }>;
}

async function processOne(
  admin: ReturnType<typeof createClient>,
  account: { id: string; cnpj: string; razao_social: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cleanCnpj = account.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      return { ok: false, error: 'CNPJ inválido' };
    }

    // Reuso da edge function existente (cache 30d, fallback OpenCNPJ→BrasilAPI)
    const { data, error } = await admin.functions.invoke('lookup-cnpj', {
      body: { cnpj: cleanCnpj },
    });

    if (error || !data) {
      return { ok: false, error: error?.message || 'sem retorno' };
    }
    if ((data as { error?: string }).error) {
      return { ok: false, error: (data as { error: string }).error };
    }

    const cnaeCodigo = (data as { cnae_principal?: { codigo?: string } })
      ?.cnae_principal?.codigo;

    if (!cnaeCodigo) {
      return { ok: false, error: 'sem CNAE no retorno' };
    }

    // Deriva segmento via função SQL (mesma lógica do front)
    const { data: segData, error: segErr } = await admin.rpc(
      'fn_cnae_to_segmento',
      { p_cnae: cnaeCodigo },
    );
    if (segErr) return { ok: false, error: segErr.message };

    const updates: Record<string, unknown> = {
      cnae: cnaeCodigo,
      updated_at: new Date().toISOString(),
    };
    if (segData) updates.segmento = segData as string;

    const { error: upErr } = await admin
      .from('accounts')
      .update(updates)
      .eq('id', account.id);

    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Parse opcional do body
    let batchSize = 25;
    try {
      const body = await req.json();
      if (typeof body?.batchSize === 'number') {
        batchSize = Math.min(Math.max(body.batchSize, 1), 100);
      }
    } catch {
      // sem body, usa default
    }

    // Busca contas elegíveis: CNPJ sem CNAE, não deletadas
    const { data: accounts, error: selErr } = await admin
      .from('accounts')
      .select('id, cnpj, razao_social')
      .is('deleted_at', null)
      .not('cnpj', 'is', null)
      .is('cnae', null)
      .limit(batchSize);

    if (selErr) throw selErr;

    const result: BackfillResult = {
      processed: 0,
      updated: 0,
      failed: 0,
      remaining: 0,
      errors: [],
    };

    for (const acc of accounts ?? []) {
      result.processed++;
      const res = await processOne(admin, acc as never);
      if (res.ok) {
        result.updated++;
      } else {
        result.failed++;
        result.errors.push({
          account_id: (acc as { id: string }).id,
          cnpj: (acc as { cnpj: string }).cnpj,
          error: res.error || 'erro desconhecido',
        });
      }
      // Throttle leve para não estourar rate limit da OpenCNPJ
      await new Promise((r) => setTimeout(r, 250));
    }

    // Quantos ainda restam após este lote
    const { count } = await admin
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('cnpj', 'is', null)
      .is('cnae', null);
    result.remaining = count ?? 0;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('[backfill-accounts-segmento] erro:', e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
