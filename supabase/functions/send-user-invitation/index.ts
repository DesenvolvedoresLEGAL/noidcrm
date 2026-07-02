import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  orgRole: string;
  permissionSetId?: string;
  teamId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, orgRole, permissionSetId, teamId }: InvitationRequest = await req.json();

    // Get user's organization
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order('joined_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const membership = memberships?.[0];

    if (!membership) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is already a member
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const existingUser = existingAuth?.users?.find(u => u.email === email);

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .eq("user_id", existingUser.id)
        .single();

      if (existingMember) {
        return new Response(JSON.stringify({ error: "Este usuário já é membro da organização" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for existing invitation
    const { data: existingInvitation } = await supabase
      .from("user_invitations")
      .select("id, status, expires_at, token")
      .eq("organization_id", membership.organization_id)
      .eq("email", email)
      .single();

    // Handle existing invitation
    if (existingInvitation) {
      const isExpired = new Date(existingInvitation.expires_at) < new Date();

      if (existingInvitation.status === "pending" && !isExpired) {
        // Invitation is still valid - return error without exposing token
        console.log(`[Invitation] Pending invitation exists for ${email}, expires at ${existingInvitation.expires_at}`);
        return new Response(JSON.stringify({ 
          error: "Não foi possível enviar o convite",
          existingInvitation: true
          // Token intentionally omitted for security
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete expired or used invitations
      await supabase
        .from("user_invitations")
        .delete()
        .eq("id", existingInvitation.id);

      console.log(`[Invitation] Deleted old invitation (status: ${existingInvitation.status}, expired: ${isExpired})`);
    }

    // Generate unique token
    const token_value = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("user_invitations")
      .insert({
        organization_id: membership.organization_id,
        email,
        invited_by: user.id,
        org_role: orgRole,
        permission_set_id: permissionSetId,
        team_id: teamId,
        token: token_value,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error("[Invitation] Failed to create invitation:", inviteError);
      return new Response(JSON.stringify({ error: "Não foi possível criar o convite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend API
    const inviteUrl = `${req.headers.get("origin") || "https://app.example.com"}/accept-invitation/${token_value}`;
    const orgName = (membership.organizations as any)?.name || "a organização";
    
    console.log("[Invitation] Preparing to send email to:", email);
    console.log("[Invitation] Invite URL:", inviteUrl);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    let emailError = null;
    
    if (!resendApiKey) {
      console.warn("[Invitation] RESEND_API_KEY not configured - email will not be sent");
      emailError = "RESEND_API_KEY não configurado";
    } else {
      try {
        console.log("[Invitation] Attempting to send email via Resend API...");
        
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev",
            to: [email],
            subject: `Você foi convidado para ${orgName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Você foi convidado!</h1>
                <p>Você foi convidado para fazer parte de <strong>${orgName}</strong>.</p>
                <p>Clique no botão abaixo para aceitar o convite e criar sua conta:</p>
                <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                  Aceitar Convite
                </a>
                <p style="color: #666; font-size: 14px;">Este convite expira em 7 dias.</p>
                <p style="color: #666; font-size: 14px;">Se você não esperava este convite, pode ignorar este email.</p>
              </div>
            `,
          }),
        });

        const responseData = await emailResponse.json();
        console.log("[Invitation] Resend API response status:", emailResponse.status);
        console.log("[Invitation] Resend API response data:", JSON.stringify(responseData));

        if (!emailResponse.ok) {
          emailError = responseData.message || "Erro ao enviar email";
          console.error("[Invitation] Failed to send email:", emailError);
        } else {
          emailSent = true;
          console.log("[Invitation] Email sent successfully! ID:", responseData.id);
        }
      } catch (err: any) {
        emailError = err.message || "Erro desconhecido";
        console.error("[Invitation] Exception while sending email:", err);
      }
    }

    console.log("[Invitation] Invitation created successfully. Email sent:", emailSent);
    
    return new Response(JSON.stringify({ 
      success: true, 
      invitation,
      emailSent,
      emailError: emailError || undefined,
      inviteUrl 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Invitation] Fatal error:", error);
    return new Response(JSON.stringify({ error: "Erro ao enviar convite" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});