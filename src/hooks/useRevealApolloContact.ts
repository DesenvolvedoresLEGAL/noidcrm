import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { revealApolloContact } from "@/services/enrichment/apolloService";

interface Vars {
  contactId: string;
  prospectId: string;
  contactName?: string;
}

export function useRevealApolloContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId }: Vars) => revealApolloContact(contactId),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["enriched-contacts", vars.prospectId] });
      const who = vars.contactName ?? "contato";
      if (res.status === "revealed") {
        toast.success(`Email e telefone revelados para ${who} (${res.credits_used ?? 2} créditos).`);
      } else if (res.status === "partial") {
        const what = res.email ? "email" : "telefone";
        toast.success(`${what} revelado para ${who} (${res.credits_used ?? 1} crédito).`);
      } else if (res.status === "skipped") {
        toast.info(res.reason ?? "Contato já revelado recentemente.");
      } else if (res.status === "no_data") {
        toast.warning(`Apollo não tem email/telefone para ${who}.`, { duration: 6000 });
      } else if (res.status === "failed") {
        toast.error(
          res.inaccessible
            ? "Sua chave Apollo não tem acesso ao endpoint people/match. Habilite no plano da Apollo."
            : res.reason ?? "Falha ao revelar contato.",
          { duration: 8000 },
        );
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao revelar contato");
    },
  });
}
