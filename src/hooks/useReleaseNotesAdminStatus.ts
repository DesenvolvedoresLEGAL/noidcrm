import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReleaseNotesAdminStatus = {
  lastDraft: {
    id: string;
    version: string;
    title: string;
    created_at: string;
    period_start?: string;
    period_end?: string;
  } | null;
  pendingDraftsCount: number;
  lastGeneration: {
    at: string;
    status: "success" | "failed";
    version?: string;
    reason?: string;
  } | null;
  lastFailure: {
    at: string;
    message: string;
  } | null;
  nextRunAt: string; // ISO — next Friday 21:00 UTC (18h BRT)
};

/**
 * Compute next Friday 21:00 UTC (matches cron `0 21 * * 5`,
 * which is 18h America/Sao_Paulo since BRT = UTC-3).
 */
function nextFriday21UTC(from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setUTCHours(21, 0, 0, 0);
  const dow = d.getUTCDay(); // 0=Sun..5=Fri
  let delta = (5 - dow + 7) % 7;
  if (delta === 0 && from.getTime() >= d.getTime()) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

/**
 * Status executivo do Release Notes Automático para o Admin Command Center.
 * Lê apenas tabelas que platform admin já tem RLS para enxergar.
 * Sanitiza payloads (sem stack trace, sem dados brutos).
 */
export function useReleaseNotesAdminStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["release-notes", "admin-status"],
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<ReleaseNotesAdminStatus> => {
      const [draftsRes, lastDraftRes, eventsRes] = await Promise.all([
        supabase
          .from("release_notes")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        supabase
          .from("release_notes")
          .select("id, version, title, created_at, source_summary")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("system_events")
          .select("event_type, payload, created_at")
          .in("event_type", ["release_note_draft_generated", "release_note_generation_failed"])
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const events = (eventsRes.data || []) as Array<{
        event_type: string;
        payload: Record<string, unknown> | null;
        created_at: string;
      }>;

      const latest = events[0];
      const latestFailure = events.find((e) => e.event_type === "release_note_generation_failed");

      const lastDraftRow = lastDraftRes.data as
        | {
            id: string;
            version: string;
            title: string;
            created_at: string;
            source_summary: { period_start?: string; period_end?: string } | null;
          }
        | null;

      return {
        lastDraft: lastDraftRow
          ? {
              id: lastDraftRow.id,
              version: lastDraftRow.version,
              title: lastDraftRow.title,
              created_at: lastDraftRow.created_at,
              period_start: lastDraftRow.source_summary?.period_start,
              period_end: lastDraftRow.source_summary?.period_end,
            }
          : null,
        pendingDraftsCount: draftsRes.count ?? 0,
        lastGeneration: latest
          ? {
              at: latest.created_at,
              status: latest.event_type === "release_note_draft_generated" ? "success" : "failed",
              version: (latest.payload?.version as string | undefined) ?? undefined,
              reason: (latest.payload?.reason as string | undefined) ?? undefined,
            }
          : null,
        lastFailure: latestFailure
          ? {
              at: latestFailure.created_at,
              // Mensagem segura: só motivo curto + reason, sem stack/payload bruto
              message:
                (latestFailure.payload?.reason as string | undefined) ??
                "Falha na geração (ver logs da função)",
            }
          : null,
        nextRunAt: nextFriday21UTC().toISOString(),
      };
    },
  });
}
