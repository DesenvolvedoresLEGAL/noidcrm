import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-context-user, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Max-Age': '86400',
};

// Retry helper for transient errors
async function withRetry<T>(
  fn: () => Promise<T> | PromiseLike<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const error = err as { name?: string; status?: number };
      const isRetryable = error?.name === 'AuthRetryableFetchError' || 
                          error?.status === 502 || 
                          error?.status === 503;
      if (!isRetryable || attempt === maxRetries - 1) {
        throw err;
      }
      console.log(`[get-current-user] Retry attempt ${attempt + 1} after error:`, error?.name);
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('[get-current-user] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user with retry for transient errors
    const { data: { user }, error: authError } = await withRetry(
      () => supabaseAuth.auth.getUser(jwt)
    );

    if (authError || !user) {
      console.error('[get-current-user] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Wrap each query with retry to tolerate transient Postgres timeouts
    const queryWithRetry = async <T = any>(fn: () => PromiseLike<T>, label: string): Promise<any> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await fn() as any;
          if (!result.error) return result;
          // Retry only on transient errors (timeout, connection)
          const msg = String(result.error?.message || '').toLowerCase();
          const isTransient = msg.includes('timeout') || msg.includes('upstream') || msg.includes('connection');
          if (!isTransient || attempt === 2) return result;
          console.log(`[get-current-user] ${label} retry ${attempt + 1}: ${msg}`);
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        } catch (e) {
          if (attempt === 2) return { data: null, error: e };
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      return { data: null, error: new Error('max retries') };
    };

    // Fetch all user data in parallel (with per-query retry)
    const [profileResult, membershipResult, rolesResult] = await Promise.all([
      queryWithRetry(() => supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(), 'profile'),

      queryWithRetry(() => supabaseAdmin
        .from('organization_members')
        .select(`*, organization:organizations(*)`)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(), 'membership'),

      queryWithRetry(() => supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id), 'roles'),
    ]);

    if ((profileResult as any).error) console.error('[get-current-user] Profile error:', (profileResult as any).error);
    if ((membershipResult as any).error) console.error('[get-current-user] Membership error:', (membershipResult as any).error);
    if ((rolesResult as any).error) console.error('[get-current-user] Roles error:', (rolesResult as any).error);

    const profile = profileResult.data;
    const membership = membershipResult.data;
    const roles = rolesResult.data?.map((r: { role: string }) => r.role) || [];

    const response = {
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
      },
      profile: profile || null,
      organization: membership?.organization || null,
      membership: membership ? {
        id: membership.id,
        role: membership.role,
        org_role: membership.org_role,
        status: membership.status,
        joined_at: membership.joined_at,
        created_at: membership.created_at,
      } : null,
      roles,
      isOwner: membership?.org_role === 'owner',
      isOrgAdmin: membership?.org_role === 'owner' || membership?.org_role === 'admin',
      hasAdminRole: roles.includes('admin'),
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (err: unknown) {
    console.error('[get-current-user] Unexpected error:', err);
    
    const error = err as { name?: string; status?: number };
    const isTransient = error?.name === 'AuthRetryableFetchError' || 
                        error?.status === 502 || 
                        error?.status === 503;
    
    return new Response(
      JSON.stringify({ error: isTransient ? 'Serviço temporariamente indisponível' : 'Erro interno do servidor' }),
      { 
        status: isTransient ? 503 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
