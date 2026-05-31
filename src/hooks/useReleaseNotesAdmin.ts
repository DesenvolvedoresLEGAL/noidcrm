import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DraftChange = { type: "feature" | "fix" | "improvement" | "security"; description: string };

export type ReleaseDraft = {
  id: string;
  version: string;
  title: string;
  description: string | null;
  release_date: string;
  is_major: boolean;
  changes: DraftChange[];
  status: "draft" | "published" | "discarded";
  generated_by: string | null;
  source_summary: { github_prs?: number; system_events?: number; period_start?: string; period_end?: string };
  created_at: string;
};

/**
 * Lista rascunhos de release notes.
 *
 * IMPORTANTE: passe `enabled=canManageDrafts` (platform/super admin) para evitar
 * que usuários não-admin disparem a query — a RLS já bloqueia, mas evitamos um
 * round-trip desnecessário ao Postgres.
 */
export function useReleaseDrafts(enabled: boolean = true) {
  return useQuery({
    queryKey: ["release-notes", "drafts"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("release_notes")
        .select("*")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        changes: Array.isArray(r.changes) ? r.changes : [],
        source_summary: r.source_summary || {},
      })) as ReleaseDraft[];
    },
  });
}

/**
 * Verifica se o GitHub está configurado para enriquecer drafts com PRs reais.
 *
 * Requer as seguintes env vars na edge function `generate-release-notes-draft`:
 *   - GITHUB_API_KEY        (token do connector GitHub via Lovable Gateway)
 *   - GITHUB_DEFAULT_OWNER  (org/usuário dono do repo)
 *   - GITHUB_DEFAULT_REPO   (nome do repositório)
 *
 * Quando ausentes, o sistema continua gerando drafts apenas com eventos
 * internos (system_events, action_executions, migrations).
 *
 * Só faz sentido chamar para platform admins — passe `enabled` apropriado.
 */
export function useGithubReleaseStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["release-notes", "github-status"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("release-notes-github-status", {
        body: {},
      });
      if (error) throw error;
      return data as { configured: boolean; missing: string[] };
    },
  });
}

export function useGenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (period_days: number) => {
      const { data, error } = await supabase.functions.invoke("generate-release-notes-draft", {
        body: { period_days, trigger: "manual" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      return data as {
        success: boolean;
        created: boolean;
        appended?: boolean;
        version?: string;
        items_used?: number;
        github_prs?: number;
        system_events?: number;
      };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["release-notes"] });
      if (r.items_used === 0) {
        toast.info("Sem novidades no período — nada a gerar.");
      } else {
        toast.success(
          `${r.appended ? "Anexado ao rascunho" : "Rascunho criado"} v${r.version} · ${r.items_used} itens (${r.github_prs || 0} PRs, ${r.system_events || 0} eventos)`,
        );
      }
    },
    onError: (e: Error) => toast.error(`Falha ao gerar: ${e.message}`),
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ReleaseDraft> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("release_notes").update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release-notes"] });
    },
    onError: (e: Error) => toast.error(`Falha ao salvar: ${e.message}`),
  });
}

export function usePublishDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("release_notes")
        .update({ status: "published", published_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release-notes"] });
      toast.success("Release publicada.");
    },
    onError: (e: Error) => toast.error(`Falha ao publicar: ${e.message}`),
  });
}

export function useDiscardDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("release_notes")
        .update({ status: "discarded" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release-notes"] });
      toast.success("Rascunho descartado.");
    },
    onError: (e: Error) => toast.error(`Falha ao descartar: ${e.message}`),
  });
}
