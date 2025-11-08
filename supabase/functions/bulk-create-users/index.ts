import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserInput {
  fullName: string;
  email: string;
  password: string;
  role: 'SDR' | 'Closer' | 'Manager';
}

interface BulkCreateRequest {
  users: UserInput[];
}

interface UserResult {
  email: string;
  success: boolean;
  error?: string;
  userId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[BulkCreate] Request from user:", user.id);

    // Get user's organization and check if admin/owner
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, org_role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order('joined_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin or owner
    if (!['admin', 'owner'].includes(membership.org_role)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários em massa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { users }: BulkCreateRequest = await req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de usuários inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[BulkCreate] Creating ${users.length} users for org ${membership.organization_id}`);

    const results: UserResult[] = [];

    for (const userInput of users) {
      try {
        console.log(`[BulkCreate] Processing user: ${userInput.email}`);

        // Validate input
        if (!userInput.email || !userInput.password || !userInput.fullName) {
          results.push({
            email: userInput.email || "unknown",
            success: false,
            error: "Dados incompletos (email, senha ou nome)",
          });
          continue;
        }

        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users?.find(u => u.email === userInput.email);

        if (userExists) {
          // Check if already member of org
          const { data: existingMember } = await supabaseAdmin
            .from("organization_members")
            .select("id")
            .eq("organization_id", membership.organization_id)
            .eq("user_id", userExists.id)
            .single();

          if (existingMember) {
            results.push({
              email: userInput.email,
              success: false,
              error: "Usuário já é membro desta organização",
            });
            continue;
          }
        }

        // Create user in auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userInput.email,
          password: userInput.password,
          email_confirm: true,
          user_metadata: {
            full_name: userInput.fullName,
          },
        });

        if (createError || !newUser.user) {
          console.error(`[BulkCreate] Error creating auth user:`, createError);
          results.push({
            email: userInput.email,
            success: false,
            error: createError?.message || "Erro ao criar usuário",
          });
          continue;
        }

        const userId = newUser.user.id;
        console.log(`[BulkCreate] Auth user created: ${userId}`);

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: userId,
            full_name: userInput.fullName,
            email: userInput.email,
            organization_id: membership.organization_id,
          });

        if (profileError) {
          console.error(`[BulkCreate] Error creating profile:`, profileError);
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          results.push({
            email: userInput.email,
            success: false,
            error: "Erro ao criar perfil",
          });
          continue;
        }

        // Add to organization_members
        const { error: memberError } = await supabaseAdmin
          .from("organization_members")
          .insert({
            user_id: userId,
            organization_id: membership.organization_id,
            org_role: 'sales',
            status: 'active',
            joined_at: new Date().toISOString(),
          });

        if (memberError) {
          console.error(`[BulkCreate] Error creating member:`, memberError);
          // Rollback
          await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
          await supabaseAdmin.auth.admin.deleteUser(userId);
          results.push({
            email: userInput.email,
            success: false,
            error: "Erro ao adicionar à organização",
          });
          continue;
        }

        // Create seller record
        const { error: sellerError } = await supabaseAdmin
          .from("sellers")
          .insert({
            user_id: userId,
            organization_id: membership.organization_id,
            name: userInput.fullName,
            role: userInput.role || 'SDR',
            active: true,
          });

        if (sellerError) {
          console.error(`[BulkCreate] Error creating seller:`, sellerError);
          // Rollback
          await supabaseAdmin.from("organization_members").delete().eq("user_id", userId);
          await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
          await supabaseAdmin.auth.admin.deleteUser(userId);
          results.push({
            email: userInput.email,
            success: false,
            error: "Erro ao criar registro de vendedor",
          });
          continue;
        }

        // Add user_roles
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: userId,
            role: 'sales',
          });

        if (roleError) {
          console.error(`[BulkCreate] Error creating role:`, roleError);
          // Continue anyway, this is not critical
        }

        results.push({
          email: userInput.email,
          success: true,
          userId: userId,
        });

        console.log(`[BulkCreate] Successfully created user: ${userInput.email}`);

      } catch (error: any) {
        console.error(`[BulkCreate] Exception processing ${userInput.email}:`, error);
        results.push({
          email: userInput.email,
          success: false,
          error: error.message || "Erro desconhecido",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    console.log(`[BulkCreate] Completed: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({ 
      success: true,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[BulkCreate] Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
