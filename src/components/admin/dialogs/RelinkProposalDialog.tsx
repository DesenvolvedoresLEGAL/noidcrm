import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Search, Loader2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RelinkProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentProposalId?: string | null;
}

export function RelinkProposalDialog({
  open,
  onOpenChange,
  organizationId,
  currentProposalId,
}: RelinkProposalDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // Search proposals
  const { data: proposals, isLoading: searchLoading } = useQuery({
    queryKey: ["admin-search-proposals", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("proposals")
        .select("id, proposal_number, total_amount, status, created_at, account:accounts(razao_social)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (searchTerm) {
        query = query.or(`proposal_number.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Relink mutation
  const relinkMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { data: userData } = await supabase.auth.getUser();

      // Get proposal details for MRR
      const { data: proposal } = await supabase
        .from("proposals")
        .select("total_amount")
        .eq("id", proposalId)
        .single();

      // Get payment terms
      const { data: paymentTerms } = await supabase
        .from("proposal_payment_terms")
        .select("monthly_value, billing_day")
        .eq("proposal_id", proposalId)
        .maybeSingle();

      const mrrValue = paymentTerms?.monthly_value || proposal?.total_amount || 0;

      // Check if slg_conversion exists for this org
      const { data: existingSlg } = await supabase
        .from("slg_conversions")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingSlg) {
        // Update existing
        const { error: updateError } = await supabase
          .from("slg_conversions")
          .update({
            proposal_id: proposalId,
            mrr_value: mrrValue,
            converted_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        if (updateError) throw updateError;
      } else {
        // Insert new - need to get opportunity data from proposal for account_id
        const { data: proposalData } = await supabase
          .from("proposals")
          .select("opportunity:opportunities!proposals_opportunity_id_fkey(account_id)")
          .eq("id", proposalId)
          .single();

        const accountId = (proposalData?.opportunity as any)?.account_id || "";

        const { error: insertError } = await supabase
          .from("slg_conversions")
          .insert({
            organization_id: organizationId,
            proposal_id: proposalId,
            account_id: accountId,
            mrr_value: mrrValue,
            converted_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_proposal_relinked",
        entity_type: "slg_conversion",
        entity_id: proposalId,
        actor_user_id: userData.user?.id,
        old_value: { proposal_id: currentProposalId },
        new_value: { proposal_id: proposalId, mrr_value: mrrValue },
      });

      return { proposalId, mrrValue };
    },
    onSuccess: ({ mrrValue }) => {
      toast.success(`Proposta vinculada com sucesso! MRR: R$ ${(mrrValue / 100).toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ["admin-org-slg"] });
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao vincular proposta: ${error.message}`);
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Relinkar Proposta
          </DialogTitle>
          <DialogDescription>
            Vincular uma proposta aceita a esta organização para cobrança via contrato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Proposal */}
          {currentProposalId && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground">Proposta Atual</Label>
              <p className="text-sm font-mono">{currentProposalId.slice(0, 8)}...</p>
            </div>
          )}

          {/* Search */}
          <div className="space-y-2">
            <Label>Buscar Proposta</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Número da proposta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Proposals List */}
          <div className="space-y-2">
            <Label>Propostas Disponíveis</Label>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {searchLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </div>
              ) : proposals && proposals.length > 0 ? (
                proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedProposalId === proposal.id ? "bg-primary/10" : ""
                    }`}
                    onClick={() => setSelectedProposalId(proposal.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">#{proposal.proposal_number}</span>
                      </div>
                      <Badge
                        variant={proposal.status === "accepted" ? "default" : "secondary"}
                        className={
                          proposal.status === "accepted"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : ""
                        }
                      >
                        {proposal.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <span>{(proposal.account as any)?.razao_social || "—"}</span>
                      <span className="mx-2">•</span>
                      <span>{formatCurrency(proposal.total_amount || 0)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {proposal.created_at && format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                  <p className="text-sm">Nenhuma proposta encontrada</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => selectedProposalId && relinkMutation.mutate(selectedProposalId)}
            disabled={!selectedProposalId || relinkMutation.isPending}
          >
            {relinkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              "Vincular Proposta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
