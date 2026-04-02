import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("id");
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  const decodedUrl = decodeURIComponent(targetUrl);

  if (emailId) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const now = new Date().toISOString();

      // Get current link_clicks
      const { data: email } = await supabase
        .from("opportunity_emails")
        .select("clicked_at, link_clicks")
        .eq("id", emailId)
        .maybeSingle();

      if (email) {
        const clicks = Array.isArray(email.link_clicks) ? email.link_clicks : [];
        clicks.push({
          url: decodedUrl,
          clicked_at: now,
          user_agent: req.headers.get("user-agent") || "",
        });

        const updates: Record<string, unknown> = {
          link_clicks: clicks,
          updated_at: now,
        };

        if (!email.clicked_at) {
          updates.clicked_at = now;
        }

        await supabase
          .from("opportunity_emails")
          .update(updates)
          .eq("id", emailId);
      }
    } catch (err) {
      console.error("Error tracking email click:", err);
    }
  }

  return new Response(null, {
    status: 302,
    headers: { "Location": decodedUrl },
  });
});
