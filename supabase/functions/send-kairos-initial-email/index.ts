// Dispara o e-mail inicial gerado pelo brief comercial do Kairós usando o SMTP do usuário.
// Se não houver SMTP configurado, cria uma activity tipo 'email' (rascunho) na timeline como fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function plainTextToHtml(text: string): string {
  // Escapa HTML básico e converte quebras de linha em <br/>
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Cada linha em parágrafo, blocos separados por linha em branco
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${paragraphs}</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      subject,
      body: emailBody,
      to,
      opportunity_id,
      account_id,
      contact_id,
      organization_id,
    } = body;

    if (!subject || !emailBody || !to || !opportunity_id || !organization_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verificar se o usuário tem SMTP ativo
    const { data: smtp } = await supabaseAdmin
      .from("user_smtp_configs")
      .select("id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtp) {
      // Tem SMTP — invocar send-smtp-email (que registra em opportunity_emails como sent)
      const htmlBody = plainTextToHtml(emailBody);
      const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-smtp-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          to_emails: [to],
          subject,
          html_body: htmlBody,
          opportunity_id,
          organization_id,
        }),
      });

      if (!sendResp.ok) {
        const errText = await sendResp.text();
        console.error("[send-kairos-initial-email] SMTP send failed:", sendResp.status, errText);
        // Cai no fallback de rascunho
      } else {
        return new Response(
          JSON.stringify({ sent: true, draft: false, channel: "smtp" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fallback: criar activity tipo email pendente (rascunho na timeline)
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .insert({
        organization_id,
        opportunity_id,
        account_id,
        contact_id,
        owner_user_id: user.id,
        type: "email",
        status: "pending",
        title: "Rascunho: e-mail inicial (Kairós)",
        description: emailBody,
        email_subject: subject,
        email_body: emailBody,
        email_to: [to],
        email_sent: false,
        ai_generated: true,
        is_automated: false,
      })
      .select("id")
      .single();

    if (actErr) {
      console.error("[send-kairos-initial-email] activity insert failed", actErr);
      return new Response(JSON.stringify({ error: actErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ sent: false, draft: true, channel: "activity", activity_id: activity.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-kairos-initial-email] fatal", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
