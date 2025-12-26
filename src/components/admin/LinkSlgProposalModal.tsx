import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Link2, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface LinkSlgProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

export function LinkSlgProposalModal({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: LinkSlgProposalModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch accepted proposals that are NOT linked yet
  const { data: availableProposals, isLoading } = useQuery({
    queryKey: ["available-slg-proposals", searchTerm],
    queryFn: async () => {
      // First, get all proposal IDs that are already linked
      const { data: linkedProposals } = await supabase
        .from("slg_conversions")
        .select("proposal_id");

      const linkedIds = linkedProposals?.map((p) => p.proposal_id) || [];

      // Fetch accepted proposals with opportunity and account data
      let query = supabase
        .from("proposals")
        .select(`
          id,
          proposal_number,
          total_amount,
          accepted_at,
          status,
          opportunities:opportunity_id (
            id,
            accounts:account_id (
              id,
              razao_social,
              nome_fantasia,
              cnpj
            )
          ),
          proposal_items (
            billing_type,
            total
          )
        `)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: false });

      // Filter out already linked proposals
      if (linkedIds.length > 0) {
        query = query.not("id", "in", `(${linkedIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by search term if provided
      if (searchTerm && data) {
        const term = searchTerm.toLowerCase();
        return data.filter((p) => {
          const opp = p.opportunities as any;
          const account = opp?.accounts;
          const clientName = account?.nome_fantasia || account?.razao_social || "";
          const cnpj = account?.cnpj || "";
          const proposalNumber = p.proposal_number || "";
          return (
            clientName.toLowerCase().includes(term) ||
            cnpj.includes(term) ||
            proposalNumber.toLowerCase().includes(term)
          );
        });
      }

      return data;
    },
    enabled: open,
  });

  // Mutation to link proposal
  const linkMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const proposal = availableProposals?.find((p) => p.id === proposalId);
      if (!proposal) throw new Error("Proposta não encontrada");

      const opp = proposal.opportunities as any;
      const account = opp?.accounts;
      const items = proposal.proposal_items as any[];
      
      // Calculate MRR based on billing_type from items
      const totalValue = Number(proposal.total_amount) || 0;
      let mrr = totalValue;
      
      // Check if any item has annual billing
      const hasAnnualBilling = items?.some((item) => 
        item.billing_type === "annual" || item.billing_type === "yearly"
      );
      const hasQuarterlyBilling = items?.some((item) => item.billing_type === "quarterly");
      const hasSemiannualBilling = items?.some((item) => item.billing_type === "semiannual");
      
      if (hasAnnualBilling) {
        mrr = totalValue / 12;
      } else if (hasSemiannualBilling) {
        mrr = totalValue / 6;
      } else if (hasQuarterlyBilling) {
        mrr = totalValue / 3;
      }

      // Create slg_conversions record
      const { error: conversionError } = await supabase
        .from("slg_conversions")
        .insert({
          organization_id: organizationId,
          proposal_id: proposalId,
          account_id: account?.id,
          mrr_value: mrr,
          total_contract_value: totalValue,
          converted_at: proposal.accepted_at || new Date().toISOString(),
          client_cnpj: account?.cnpj,
        });

      if (conversionError) throw conversionError;

      // Log audit event
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "slg_proposal_linked",
        entity_type: "slg_conversion",
        entity_id: proposalId,
        actor_user_id: userData.user?.id,
        metadata: {
          proposal_number: proposal.proposal_number,
          client_name: account?.nome_fantasia || account?.razao_social,
          mrr_value: mrr,
          manual_link: true,
        },
      });

      return { proposal, account };
    },
    onSuccess: ({ proposal, account }) => {
      toast.success(
        `Proposta ${proposal.proposal_number} vinculada com sucesso`,
        {
          description: `Cliente: ${account?.nome_fantasia || account?.razao_social}`,
        }
      );
      queryClient.invalidateQueries({ queryKey: ["admin-org-slg-conversions", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["available-slg-proposals"] });
      onOpenChange(false);
      setSelectedProposalId(null);
      setSearchTerm("");
    },
    onError: (error: any) => {
      toast.error("Erro ao vincular proposta", {
        description: error.message,
      });
    },
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getBillingTypeLabel = (items: any[] | null) => {
    if (!items || items.length === 0) return "Mensal";
    
    const hasAnnual = items.some((i) => i.billing_type === "annual" || i.billing_type === "yearly");
    const hasSemiannual = items.some((i) => i.billing_type === "semiannual");
    const hasQuarterly = items.some((i) => i.billing_type === "quarterly");
    
    if (hasAnnual) return "Anual";
    if (hasSemiannual) return "Semestral";
    if (hasQuarterly) return "Trimestral";
    return "Mensal";
  };

  const calculateMrr = (proposal: any) => {
    const totalValue = Number(proposal.total_amount) || 0;
    const items = proposal.proposal_items as any[];
    
    const hasAnnual = items?.some((i) => i.billing_type === "annual" || i.billing_type === "yearly");
    const hasSemiannual = items?.some((i) => i.billing_type === "semiannual");
    const hasQuarterly = items?.some((i) => i.billing_type === "quarterly");
    
    if (hasAnnual) return totalValue / 12;
    if (hasSemiannual) return totalValue / 6;
    if (hasQuarterly) return totalValue / 3;
    return totalValue;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular Proposta SLG
          </DialogTitle>
          <DialogDescription>
            Vincule uma proposta aceita à organização <strong>{organizationName}</strong>.
            Isto permite associar vendas de CNPJs diferentes à mesma empresa.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Proposals List */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !availableProposals?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma proposta aceita disponível para vinculação</p>
              <p className="text-sm">
                {searchTerm
                  ? "Tente outro termo de busca"
                  : "Todas as propostas aceitas já estão vinculadas"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">MRR Calculado</TableHead>
                  <TableHead>Aceita em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableProposals.map((proposal) => {
                  const opp = proposal.opportunities as any;
                  const account = opp?.accounts;
                  const clientName = account?.nome_fantasia || account?.razao_social || "—";
                  const cnpj = account?.cnpj || "—";
                  const isSelected = selectedProposalId === proposal.id;
                  const mrr = calculateMrr(proposal);

                  return (
                    <TableRow
                      key={proposal.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedProposalId(isSelected ? null : proposal.id)}
                    >
                      <TableCell>
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {proposal.proposal_number}
                      </TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {cnpj}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(proposal.total_amount)}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {getBillingTypeLabel(proposal.proposal_items as any[])}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(mrr)}/mês
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {proposal.accepted_at
                          ? format(new Date(proposal.accepted_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedProposalId(null);
              setSearchTerm("");
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => selectedProposalId && linkMutation.mutate(selectedProposalId)}
            disabled={!selectedProposalId || linkMutation.isPending}
          >
            {linkMutation.isPending ? "Vinculando..." : "Vincular Proposta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
