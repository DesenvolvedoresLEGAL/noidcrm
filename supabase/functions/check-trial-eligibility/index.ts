import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EligibilityRequest {
  email: string;
  browserHash: string;
  deviceType?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  canvasHash?: string;
  cpfHash?: string;
  cnpjHash?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: EligibilityRequest = await req.json();
    const { email, browserHash, deviceType, screenResolution, timezone, language, canvasHash, cpfHash, cnpjHash } = body;

    if (!email || !browserHash) {
      return new Response(
        JSON.stringify({ eligible: false, reason: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract email domain
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      return new Response(
        JSON.stringify({ eligible: false, reason: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     '0.0.0.0';

    const riskFlags: string[] = [];
    let fraudScore = 0;

    // 1. Check if email is disposable
    const { data: disposableDomain } = await supabaseAdmin
      .from('disposable_email_domains')
      .select('domain')
      .eq('domain', emailDomain)
      .maybeSingle();

    if (disposableDomain) {
      fraudScore += 40;
      riskFlags.push('disposable_email');
    }

    // 2. Check if browser hash already exists
    const { data: existingFingerprint } = await supabaseAdmin
      .from('trial_fingerprints')
      .select('id, organization_id')
      .eq('browser_hash', browserHash)
      .maybeSingle();

    if (existingFingerprint) {
      fraudScore += 50;
      riskFlags.push('duplicate_device');
    }

    // 3. Check IP rate limiting (max 2 trials per IP per 24h)
    const { count: ipAttempts } = await supabaseAdmin
      .from('ip_trial_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIP)
      .gte('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if ((ipAttempts || 0) >= 2) {
      fraudScore += 30;
      riskFlags.push('ip_rate_limit');
    }

    // 4. Check CPF hash if provided
    if (cpfHash) {
      const { data: existingCpf } = await supabaseAdmin
        .from('trial_fingerprints')
        .select('id')
        .eq('cpf_hash', cpfHash)
        .maybeSingle();

      if (existingCpf) {
        fraudScore += 60;
        riskFlags.push('duplicate_cpf');
      }
    }

    // 5. Check CNPJ hash if provided
    if (cnpjHash) {
      const { data: existingCnpj } = await supabaseAdmin
        .from('trial_fingerprints')
        .select('id')
        .eq('cnpj_hash', cnpjHash)
        .maybeSingle();

      if (existingCnpj) {
        fraudScore += 60;
        riskFlags.push('duplicate_cnpj');
      }
    }

    // Cap score at 100
    fraudScore = Math.min(fraudScore, 100);

    // Log the attempt
    await supabaseAdmin
      .from('ip_trial_attempts')
      .insert({
        ip_address: clientIP,
        email_domain: emailDomain,
        was_blocked: fraudScore >= 70,
        block_reason: fraudScore >= 70 ? riskFlags.join(', ') : null,
      });

    // Determine eligibility
    const eligible = fraudScore < 70;
    const requiresVerification = fraudScore >= 50 && fraudScore < 70;

    // Determine risk level
    let riskLevel = 'low';
    if (fraudScore >= 70) riskLevel = 'blocked';
    else if (fraudScore >= 50) riskLevel = 'high';
    else if (fraudScore >= 30) riskLevel = 'medium';

    console.log(`[Trial Eligibility] Email: ${email}, Score: ${fraudScore}, Eligible: ${eligible}, Flags: ${riskFlags.join(', ')}`);

    return new Response(
      JSON.stringify({
        eligible,
        requiresVerification,
        message: !eligible
          ? 'Não foi possível iniciar o trial. Entre em contato com o suporte.'
          : requiresVerification
          ? 'Verificação adicional necessária. Confirme seu telefone.'
          : 'Você está elegível para o trial!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Trial Eligibility] Error:', error);

    // Do not leak internal error details to clients.
    return new Response(
      JSON.stringify({
        eligible: false,
        message: 'Serviço indisponível. Tente novamente em instantes.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
