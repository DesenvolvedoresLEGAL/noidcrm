import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("id");

  if (!emailId) {
    return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current record
    const { data: email } = await supabase
      .from("opportunity_emails")
      .select("opened_at, opened_count")
      .eq("id", emailId)
      .maybeSingle();

    if (email) {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        opened_count: (email.opened_count || 0) + 1,
        updated_at: now,
      };

      // Only set opened_at on first open
      if (!email.opened_at) {
        updates.opened_at = now;
      }

      await supabase
        .from("opportunity_emails")
        .update(updates)
        .eq("id", emailId);
    }
  } catch (err) {
    console.error("Error tracking email open:", err);
  }

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
});
