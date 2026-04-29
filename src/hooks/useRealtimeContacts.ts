import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { toast } from "sonner";

/**
 * Global realtime listener for enriched_contact_profiles.
 * Mounts once at the authenticated layout level. Emits toasts on:
 * - new contact inserted (decision-maker found)
 * - is_primary flipped to true (primary updated)
 * - is_merged flipped to true (silent — only invalidates queries)
 */
export function useRealtimeContacts() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const recentToastIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!orgId) return;

    const showToastOnce = (id: string, fn: () => void) => {
      if (recentToastIds.current.has(id)) return;
      recentToastIds.current.add(id);
      fn();
      setTimeout(() => recentToastIds.current.delete(id), 5000);
    };

    const channel = supabase
      .channel(`realtime-contacts-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enriched_contact_profiles",
          filter: `workspace_id=eq.${orgId}`,
        },
        (payload: any) => {
          const c = payload.new;
          if (!c || c.is_merged) return;
          const sen = (c.seniority as string | null) ?? "";
          const isDM = ["c_level", "vp", "director"].includes(sen);
          if (!isDM) return;
          showToastOnce(`ins-${c.id}`, () => {
            toast.success("🎯 Novo decisor encontrado", {
              description: `${c.full_name ?? c.email ?? "Contato"} · ${c.role_title ?? sen}`,
            });
          });
          qc.invalidateQueries({ queryKey: ["enriched-contacts", c.prospect_id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "enriched_contact_profiles",
          filter: `workspace_id=eq.${orgId}`,
        },
        (payload: any) => {
          const oldRow = payload.old ?? {};
          const newRow = payload.new ?? {};
          if (!oldRow.is_primary && newRow.is_primary) {
            showToastOnce(`prim-${newRow.id}`, () => {
              toast("🔄 Decisor principal atualizado", {
                description: `${newRow.full_name ?? newRow.email ?? "Contato"}`,
              });
            });
          }
          qc.invalidateQueries({ queryKey: ["enriched-contacts", newRow.prospect_id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}
