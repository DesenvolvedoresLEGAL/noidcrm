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
  role: 'SDR' | 'Closer' | 'Manager' | 'CS';
}

// Map display roles to org_role values
const roleMapping: Record<string, string> = {
  'SDR': 'sales',
  'Closer': 'sales',
  'Manager': 'manager',
  'CS': 'cs',
};

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

    // Parse body early for possible admin bypass
    const body = await req.json().catch(() => null);
    const users: UserInput[] | undefined = body?.users;
    const adminSecret: string | undefined = body?.adminSecret;
    const orgIdOverride: string | undefined = body?.orgId;

    let membership: { organization_id: string; org_role: string } | null = null;

    // Admin bypass using secret (no JWT required)
    const bypassKey = Deno.env.get("LOVABLE_API_KEY");
    if (adminSecret && bypassKey && adminSecret === bypassKey) {
      if (!orgIdOverride) {
        return new Response(JSON.stringify({ error: "orgId é obrigatório quando usando adminSecret" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      membership = { organization_id: orgIdOverride, org_role: 'owner' };
      console.log(`[BulkCreate] Admin bypass enabled for org ${orgIdOverride}`);
    } else {
      // Get authenticated user via JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      const { data: member } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id, org_role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order('joined_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (!member) {
        return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      membership = member as any;

      // Check if user is admin or owner
      if (!['admin', 'owner'].includes((membership as any).org_role)) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários em massa" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const orgId = (membership as { organization_id: string }).organization_id;

    // Input validation
    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de usuários inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch size limit to prevent DOS attacks
    const MAX_BATCH_SIZE = 50;
    if (users.length > MAX_BATCH_SIZE) {
      console.warn(`[BulkCreate] Batch size ${users.length} exceeds limit of ${MAX_BATCH_SIZE}`);
      return new Response(
        JSON.stringify({ 
          error: `Máximo de ${MAX_BATCH_SIZE} usuários por requisição. Você enviou ${users.length}.` 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[BulkCreate] Creating ${users.length} users for org ${orgId}`);

    const results: UserResult[] = [];

    for (const userInput of users) {
      try {
        console.log(`[BulkCreate] Processing user: ${userInput.email}`);

        // Enhanced input validation
        if (!userInput.email || !userInput.password || !userInput.fullName) {
          results.push({
            email: userInput.email || "unknown",
            success: false,
            error: "Dados incompletos",
          });
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userInput.email)) {
          results.push({
            email: userInput.email,
            success: false,
            error: "Email inválido",
          });
          continue;
        }

        // Validate password strength (min 6 chars)
        if (userInput.password.length < 6) {
          results.push({
            email: userInput.email,
            success: false,
            error: "Senha muito curta",
          });
          continue;
        }

        // Validate name length
        if (userInput.fullName.length < 2 || userInput.fullName.length > 100) {
          results.push({
            email: userInput.email,
            success: false,
            error: "Nome inválido",
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
            .eq("organization_id", orgId)
            .eq("user_id", userExists.id)
            .single();

          if (existingMember) {
            console.log(`[BulkCreate] User ${userInput.email} is already a member of org ${orgId}`);
            results.push({
              email: userInput.email,
              success: false,
              error: "Usuário já cadastrado",
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
            error: "Erro ao criar usuário",
          });
          continue;
        }

        const userId = newUser.user.id;
        console.log(`[BulkCreate] Auth user created: ${userId}`);

        // Check if profile exists (created by trigger)
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        let profileError;

        if (existingProfile) {
          // Profile already exists, update it
          console.log(`[BulkCreate] Profile exists, updating with org data`);
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              full_name: userInput.fullName,
              email: userInput.email,
              organization_id: orgId,
            })
            .eq("user_id", userId);
          profileError = error;
        } else {
          // Profile doesn't exist, create it (fallback)
          console.log(`[BulkCreate] Profile doesn't exist, creating`);
          const { error } = await supabaseAdmin
            .from("profiles")
            .insert({
              user_id: userId,
              full_name: userInput.fullName,
              email: userInput.email,
              organization_id: orgId,
            });
          profileError = error;
        }

        if (profileError) {
          console.error(`[BulkCreate] Error with profile:`, profileError);
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          results.push({
            email: userInput.email,
            success: false,
            error: "Erro ao criar perfil",
          });
          continue;
        }

        // Add to organization_members with correct org_role
        const orgRole = roleMapping[userInput.role] || 'sales';
        const { error: memberError } = await supabaseAdmin
          .from("organization_members")
          .insert({
            user_id: userId,
            organization_id: orgId,
            org_role: orgRole,
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
            error: "Erro na criação",
          });
          continue;
        }

        // Create seller record
        const { error: sellerError } = await supabaseAdmin
          .from("sellers")
          .insert({
            user_id: userId,
            organization_id: orgId,
            name: userInput.fullName,
            email: userInput.email,
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
            error: "Erro na criação",
          });
          continue;
        }

        // Add user_roles with correct app_role
        const appRole = orgRole === 'cs' ? 'cs' : (orgRole === 'manager' ? 'manager' : 'sales');
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: userId,
            role: appRole,
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
          error: "Erro ao processar usuário",
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
    return new Response(JSON.stringify({ error: "Erro ao criar usuários" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
