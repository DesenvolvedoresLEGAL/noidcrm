// Sprint 2.6 — Supabase client factories for V2 report edge functions.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Authenticated client bound to the caller JWT. Use only to:
 *  - resolve the caller identity / organization
 *  - check role-based permissions
 * Never use it to read aggregate views (RLS would reject org-wide aggregates).
 */
export function userClient(authHeader: string | null): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client used to read canonical V2 views.
 * Always scope queries by organization_id explicitly — never trust the caller payload alone.
 */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
