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
        toast.success(`Telefone e e-mail salvos para ${who}.`);
      } else if (res.status === "partial") {
        const what = res.email ? "E-mail" : "Telefone";
        toast.success(`${what} salvo para ${who}.`);
      } else if (res.status === "pending") {
        toast.info(`Buscando dados de ${who} no Apollo… o status atualiza automaticamente.`, { duration: 7000 });
        setTimeout(() => qc.invalidateQueries({ queryKey: ["enriched-contacts", vars.prospectId] }), 30_000);
        setTimeout(() => qc.invalidateQueries({ queryKey: ["enriched-contacts", vars.prospectId] }), 90_000);
      } else if (res.status === "rejected_company_phone") {
        toast.info(`Apollo só encontrou o telefone da empresa para ${who}. Nenhum crédito confirmado.`);
      } else if (res.status === "skipped") {
        toast.info(res.reason ?? "Contato já revelado recentemente.");
      } else if (res.status === "no_data" || res.status === "not_found") {
        toast.warning(`Apollo não tem e-mail/telefone individual para ${who}.`, { duration: 6000 });
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
