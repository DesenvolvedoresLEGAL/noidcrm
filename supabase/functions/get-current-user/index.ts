import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('[get-current-user] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-current-user] Fetching data for user:', user.id);

    // Fetch all user data in parallel
    const [profileResult, membershipResult, rolesResult] = await Promise.all([
      // Get profile
      supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      
      // Get active organization membership
      supabaseClient
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      
      // Get user roles
      supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id),
    ]);

    // Check for errors
    if (profileResult.error) {
      console.error('[get-current-user] Profile error:', profileResult.error);
    }
    if (membershipResult.error) {
      console.error('[get-current-user] Membership error:', membershipResult.error);
    }
    if (rolesResult.error) {
      console.error('[get-current-user] Roles error:', rolesResult.error);
    }

    const profile = profileResult.data;
    const membership = membershipResult.data;
    const roles = rolesResult.data?.map(r => r.role) || [];

    // Prepare response
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
      // Computed flags for convenience
      isOwner: membership?.role === 'owner',
      isOrgAdmin: membership?.role === 'owner' || membership?.role === 'admin',
      hasAdminRole: roles.includes('admin'),
    };

    console.log('[get-current-user] Success:', {
      userId: user.id,
      hasProfile: !!profile,
      hasOrg: !!membership,
      roles,
    });

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=30', // Cache for 30 seconds
        },
      }
    );
  } catch (error) {
    console.error('[get-current-user] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
