// Lightweight wrapper to instrument edge function execution durations.
// Usage:
//   const log = createRunLogger(supabase, 'my-function', orgId);
//   await log.run(async () => { ... });

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RunLogger {
  run<T>(fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T>;
}

export function createRunLogger(
  supabase: SupabaseClient,
  functionName: string,
  organizationId?: string | null,
): RunLogger {
  return {
    async run<T>(fn: () => Promise<T>, metadata: Record<string, unknown> = {}): Promise<T> {
      const startedAt = Date.now();
      let status: "success" | "error" = "success";
      let errorMessage: string | null = null;

      try {
        const result = await fn();
        return result;
      } catch (err) {
        status = "error";
        errorMessage = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const duration = Date.now() - startedAt;
        // Best-effort logging; never let logging break the function.
        try {
          await supabase.from("automation_run_log").insert({
            function_name: functionName,
            organization_id: organizationId ?? null,
            duration_ms: duration,
            status,
            error_message: errorMessage,
            metadata,
          });
        } catch (logErr) {
          console.error(`[run-logger:${functionName}] failed to write log:`, logErr);
        }
      }
    },
  };
}
