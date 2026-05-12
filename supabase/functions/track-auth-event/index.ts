import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

interface GeoIPData {
  country: string;
  countryCode: string;
  city: string;
  regionName: string;
  isp: string;
  proxy: boolean;
  hosting: boolean;
}

function getClientIP(req: Request): string {
  const headers = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
  ];
  
  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      return value.split(',')[0].trim();
    }
  }
  
  return 'unknown';
}

async function getGeoIP(ip: string): Promise<GeoIPData | null> {
  try {
    if (ip === 'unknown' || ip.startsWith('192.168') || ip.startsWith('10.') || ip === '127.0.0.1' || ip.startsWith('172.')) {
      return null;
    }
    
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,countryCode,city,regionName,isp,proxy,hosting`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);

    if (!response.ok) return null;
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const data = await response.json();
    if (data.status === 'fail') return null;
    return data;
  } catch (error) {
    console.error('[track-auth-event] GeoIP lookup failed:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      console.warn('[track-auth-event] Invalid JSON payload (non-blocking)');
      return jsonResponse({ success: false, error: 'invalid_payload' });
    }
    const {
      event_type,
      user_id,
      email,
      success = true,
      error_message,
      fingerprint,
      audit_context,
    } = body;

    if (!event_type || !email) {
      console.warn('[track-auth-event] Missing event_type/email (non-blocking)');
      return jsonResponse({ success: false, error: 'missing_required_fields' });
    }

    console.log(`[track-auth-event] Processing ${event_type} for ${email}`);

    const clientIP = getClientIP(req);
    console.log(`[track-auth-event] Client IP: ${clientIP}`);

    const geoData = await getGeoIP(clientIP);

    const auditRecord = {
      user_id: user_id || null,
      email,
      event_type,
      success,
      error_message: error_message || null,
      
      ip_address: clientIP !== 'unknown' ? clientIP : null,
      country_code: geoData?.countryCode || null,
      country_name: geoData?.country || null,
      city: geoData?.city || null,
      region: geoData?.regionName || null,
      isp: geoData?.isp || null,
      is_vpn: geoData?.hosting || false,
      is_proxy: geoData?.proxy || false,
      
      user_agent: audit_context?.userAgent || null,
      device_type: fingerprint?.deviceType || null,
      browser_hash: fingerprint?.browserHash || null,
      canvas_hash: fingerprint?.canvasHash || null,
      screen_resolution: fingerprint?.screenResolution || null,
      timezone: fingerprint?.timezone || null,
      language: fingerprint?.language || null,
      
      referrer: audit_context?.referrer || null,
      page_url: audit_context?.pageUrl || null,
      
      metadata: {
        rawHeaders: {
          'x-forwarded-for': req.headers.get('x-forwarded-for'),
          'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
          'x-real-ip': req.headers.get('x-real-ip'),
        },
        geoRaw: geoData,
        fingerprintRaw: fingerprint,
      }
    };

    let inserted = true;
    try {
      const { error: insertError } = await withTimeout(
        supabase
          .from('auth_audit_log')
          .insert(auditRecord),
        1800,
        'auth_audit_insert'
      );
      if (insertError) {
        inserted = false;
        const msg = insertError?.message || String(insertError);
        console.warn('[track-auth-event] Insert failed (non-blocking):', msg.slice(0, 200));
      }
    } catch (e) {
      inserted = false;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[track-auth-event] Insert threw (non-blocking):', msg.slice(0, 200));
    }

    return jsonResponse({
      success: true,
      inserted,
      ip: clientIP,
      country: geoData?.country || null,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Never break the auth flow: respond 200 with success:false.
    console.warn('[track-auth-event] Soft error (non-blocking):', errorMessage.slice(0, 200));
    return jsonResponse({
      success: false,
      error: 'tracking_unavailable',
    });
  }
});
