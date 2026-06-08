import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hosts allowed as redirect targets. Built-in safe defaults plus any extra
// hostnames configured via ALLOWED_REDIRECT_DOMAINS (comma-separated).
const DEFAULT_ALLOWED_HOSTS = [
  "noid-crm.lovable.app",
  "crm.humanoid-os.ai",
  "humanoid-os.ai",
  "urihdqturaebhiefwjnw.supabase.co",
  "lovable.app",
];

function isHostAllowed(hostname: string, allowed: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowed.some((allowedHost) => {
    const a = allowedHost.toLowerCase().trim();
    if (!a) return false;
    return host === a || host.endsWith(`.${a}`);
  });
}

function safeRedirect(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  // Only allow http/https — blocks javascript:, data:, file:, etc.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const extra = (Deno.env.get("ALLOWED_REDIRECT_DOMAINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = [...DEFAULT_ALLOWED_HOSTS, ...extra];

  if (!isHostAllowed(parsed.hostname, allowed)) return null;
  return parsed;
}

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("id");
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  const decodedUrl = decodeURIComponent(targetUrl);
  const safe = safeRedirect(decodedUrl);
  if (!safe) {
    console.warn("track-email-click rejected URL", { decodedUrl });
    return new Response("Invalid redirect target", { status: 400 });
  }

  if (emailId) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const now = new Date().toISOString();

      const { data: email } = await supabase
        .from("opportunity_emails")
        .select("clicked_at, link_clicks")
        .eq("id", emailId)
        .maybeSingle();

      if (email) {
        const clicks = Array.isArray(email.link_clicks) ? email.link_clicks : [];
        clicks.push({
          url: safe.toString(),
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
    headers: { "Location": safe.toString() },
  });
});
