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
  orgRole?: string; // Tipo do usuário (sales, cs, manager, admin, finance, operations, viewer)
}

// Map display roles to org_role values
const roleMapping: Record<string, string> = {
  'SDR': 'sales',
  'Closer': 'sales',
  'Manager': 'manager',
  'CS': 'cs',
  'Operations': 'operations',
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

    const body = await req.json().catch(() => null);
    const users: UserInput[] | undefined = body?.users;
    const orgIdOverride: string | undefined = body?.orgId;

    let membership: { organization_id: string; org_role: string } | null = null;

    // Internal-only bypass using server-side secret (never exposed to client)
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
    if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
      if (!orgIdOverride) {
        return new Response(JSON.stringify({ error: "orgId é obrigatório para chamadas internas" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      membership = { organization_id: orgIdOverride, org_role: 'owner' };
      console.log(`[BulkCreate] Internal bypass for org ${orgIdOverride}`);
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

        // Determine org_role upfront - prioritize explicit orgRole from frontend
        const orgRole = userInput.orgRole || roleMapping[userInput.role] || 'sales';
        console.log(`[BulkCreate] User ${userInput.email} will have org_role: ${orgRole} (from orgRole: ${userInput.orgRole}, role: ${userInput.role})`);

        // Check if user already exists by email
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000, // Get enough users to search
        });
        
        const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === userInput.email.toLowerCase());
        
        if (existingUser) {
          // User exists in auth, check if already member of this org
          const { data: existingMember } = await supabaseAdmin
            .from("organization_members")
            .select("id")
            .eq("organization_id", orgId)
            .eq("user_id", existingUser.id)
            .single();

          if (existingMember) {
            console.log(`[BulkCreate] User ${userInput.email} is already a member of org ${orgId}`);
            results.push({
              email: userInput.email,
              success: false,
              error: "Não foi possível processar este cadastro",
            });
            continue;
          } else {
            // User exists but not in this org - add them to org
            console.log(`[BulkCreate] User ${userInput.email} exists, adding to org ${orgId} with org_role: ${orgRole}`);
            
            const userId = existingUser.id;
            
            // Check if profile exists, create if not
            const { data: existingProfile } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("id", userId)
              .single();

            if (!existingProfile) {
              console.log(`[BulkCreate] Creating profile for existing user ${userInput.email}`);
              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .insert({
                  id: userId,
                  user_id: userId,
                  full_name: userInput.fullName,
                  email: existingUser.email,
                });
              
              if (profileError) {
                console.error(`[BulkCreate] Error creating profile:`, profileError);
              }
            }
            
            // Add to organization_members - use upsert to handle race conditions
            const { error: memberError } = await supabaseAdmin
              .from("organization_members")
              .upsert({
                organization_id: orgId,
                user_id: userId,
                role: "member",
                org_role: orgRole,
                status: "active",
                joined_at: new Date().toISOString(),
              }, {
                onConflict: 'organization_id,user_id',
                ignoreDuplicates: false
              });

            if (memberError) {
              console.error(`[BulkCreate] Error adding existing user to org:`, memberError);
              results.push({
                email: userInput.email,
                success: false,
                error: "Erro ao adicionar usuário à organização",
              });
              continue;
            }

            results.push({
              email: userInput.email,
              success: true,
            });
            continue;
          }
        }

        // Create new user in auth
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
          
          // Provide more specific error message
          let errorMessage = "Erro ao criar usuário";
          if (createError?.message?.includes("already been registered")) {
            errorMessage = "Este email já está cadastrado no sistema";
          } else if (createError?.message) {
            errorMessage = createError.message;
          }
          
          results.push({
            email: userInput.email,
            success: false,
            error: errorMessage,
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

        // Add to organization_members with correct org_role - use upsert to handle race conditions
        const { error: memberError } = await supabaseAdmin
          .from("organization_members")
          .upsert({
            user_id: userId,
            organization_id: orgId,
            org_role: orgRole,
            status: 'active',
            joined_at: new Date().toISOString(),
          }, {
            onConflict: 'organization_id,user_id',
            ignoreDuplicates: false
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
        let appRole = 'sales';
        if (orgRole === 'cs') appRole = 'cs';
        else if (orgRole === 'manager') appRole = 'manager';
        else if (orgRole === 'admin') appRole = 'admin';
        else if (orgRole === 'operations') appRole = 'user'; // Operations gets basic user role
        
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
