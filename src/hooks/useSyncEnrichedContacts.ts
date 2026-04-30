import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { syncEnrichedContactsToAccount } from "@/services/enrichment/apolloService";
import { contactKeys, accountKeys, opportunityKeys } from "@/lib/query-keys";

interface Vars {
  prospectId: string;
  accountId: string;
  contactIds: string[];
}

export function useSyncEnrichedContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prospectId, accountId, contactIds }: Vars) =>
      syncEnrichedContactsToAccount(prospectId, accountId, contactIds),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: contactKeys.lists() });
      qc.invalidateQueries({ queryKey: accountKeys.detail(vars.accountId) });
      qc.invalidateQueries({ queryKey: opportunityKeys.lists() });
      qc.invalidateQueries({ queryKey: ["enriched-contacts", vars.prospectId] });
      qc.invalidateQueries({ queryKey: ["contacts", vars.accountId] });

      const parts: string[] = [];
      if (res.created > 0) parts.push(`${res.created} criado${res.created > 1 ? "s" : ""}`);
      if (res.updated > 0) parts.push(`${res.updated} atualizado${res.updated > 1 ? "s" : ""}`);
      if (res.skipped > 0) parts.push(`${res.skipped} ignorado${res.skipped > 1 ? "s" : ""} (sem dados)`);
      if (parts.length === 0) {
        toast.info("Nenhum contato sincronizado");
      } else {
        toast.success(`Contatos no CRM: ${parts.join(" · ")}`);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao sincronizar contatos com o CRM");
    },
  });
}
