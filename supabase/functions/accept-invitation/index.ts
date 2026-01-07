import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInvitationRequest {
  token: string;
  fullName: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, fullName, password }: AcceptInvitationRequest = await req.json();

    if (!token || !fullName || !password) {
      return new Response(
        JSON.stringify({ error: "Token, nome completo e senha são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Fetch and validate invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("user_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation not found:", invitationError);
      return new Response(
        JSON.stringify({ error: "Convite inválido ou já utilizado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from("user_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ error: "Este convite expirou. Solicite um novo convite ao administrador." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2. Check if email is already registered
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    if (emailExists) {
      return new Response(
        JSON.stringify({ 
          error: "Este email já está cadastrado. Faça login para acessar o sistema." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 3. Create user account
    const { data: newUser, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true, // Auto-confirm email since invitation is verified
      user_metadata: {
        full_name: fullName,
      },
    });

    if (signUpError || !newUser.user) {
      console.error("Error creating user:", signUpError);
      return new Response(
        JSON.stringify({ error: `Erro ao criar conta: ${signUpError?.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User created successfully:", newUser.user.id);

    // 4. Update profile with organization_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        organization_id: invitation.organization_id,
        full_name: fullName
      })
      .eq("user_id", newUser.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Continue anyway - profile update is not critical
    }

    // 5. Add to organization_members
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        user_id: newUser.user.id,
        organization_id: invitation.organization_id,
        role: "member",
        org_role: invitation.org_role || "sales",
        permission_set_id: invitation.permission_set_id,
        status: "active",
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error("Error adding to organization:", memberError);
      return new Response(
        JSON.stringify({ error: `Erro ao adicionar à organização: ${memberError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 6. Add to team if specified
    if (invitation.team_id) {
      const { error: teamError } = await supabaseAdmin
        .from("team_members")
        .insert({
          team_id: invitation.team_id,
          user_id: newUser.user.id,
          role: "member",
        });

      if (teamError) {
        console.error("Error adding to team:", teamError);
        // Continue anyway - team assignment is not critical
      }
    }

    // 7. Mark invitation as accepted
    const { error: updateInvitationError } = await supabaseAdmin
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateInvitationError) {
      console.error("Error updating invitation status:", updateInvitationError);
      // Continue anyway - the important work is done
    }

    // 8. Create audit log entry
    await supabaseAdmin.from("audit_log").insert({
      organization_id: invitation.organization_id,
      actor_user_id: newUser.user.id,
      action: "invitation_accepted",
      entity_type: "user_invitation",
      entity_id: invitation.id,
      metadata: {
        invited_by: invitation.invited_by,
        org_role: invitation.org_role,
        email: invitation.email,
      },
    });

    // 9. Generate login link for automatic authentication
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: invitation.email,
    });

    if (linkError || !linkData) {
      console.error("Error generating login link:", linkError);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Conta criada com sucesso! Você pode fazer login agora.",
          requiresLogin: true
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract tokens from the link
    const url = new URL(linkData.properties.action_link);
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Conta criada com sucesso! Você pode fazer login agora.",
          requiresLogin: true
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conta criada com sucesso!",
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name: fullName,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in accept-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
