import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, AlertTriangle, FileCheck } from "lucide-react";

interface OrganizationContractsTabProps {
  organizationId: string;
}

export function OrganizationContractsTab({ organizationId }: OrganizationContractsTabProps) {
  // Fetch contracts for this organization
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["admin-org-contracts", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          id,
          title,
          status,
          contract_value,
          start_date,
          end_date,
          created_at,
          accounts:account_id (
            razao_social,
            nome_fantasia
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Fetch SLG conversions (accepted proposals linked to this organization)
  const { data: slgConversions, isLoading: slgLoading } = useQuery({
    queryKey: ["admin-org-slg-conversions", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slg_conversions")
        .select(`
          id,
          proposal_id,
          mrr_value,
          converted_at,
          proposals:proposal_id (
            proposal_number,
            total_value,
            status,
            payment_terms,
            accounts:account_id (
              razao_social,
              nome_fantasia
            )
          )
        `)
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const isLoading = contractsLoading || slgLoading;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
      pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
      active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
      expiring: { label: "Expirando", className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
      expired: { label: "Expirado", className: "bg-destructive/10 text-destructive border-destructive/20" },
      cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
      renewed: { label: "Renovado", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      accepted: { label: "Aceita", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalContractValue = contracts?.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0) || 0;
  const totalSlgMrr = slgConversions?.reduce((sum, s) => sum + (Number(s.mrr_value) || 0), 0) || 0;
  const activeContracts = contracts?.filter(c => c.status === 'active').length || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasContracts = contracts && contracts.length > 0;
  const hasSlgConversions = slgConversions && slgConversions.length > 0;

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Acesso a dados de contrato desta organização. Ação registrada em auditoria (LGPD).
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contratos</p>
                <p className="text-2xl font-bold">{contracts?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Propostas SLG</p>
                <p className="text-2xl font-bold">{slgConversions?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contratos Ativos</p>
                <p className="text-2xl font-bold">{activeContracts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR (SLG)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSlgMrr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLG Conversions (Accepted Proposals) */}
      {hasSlgConversions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-500" />
              Propostas Aceitas (SLG)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Convertido em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slgConversions?.map((conversion) => {
                  const proposal = conversion.proposals as any;
                  const account = proposal?.accounts as { razao_social?: string; nome_fantasia?: string } | null;
                  const clientName = account?.nome_fantasia || account?.razao_social || "—";
                  
                  return (
                    <TableRow key={conversion.id}>
                      <TableCell className="font-medium font-mono">
                        {proposal?.proposal_number || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{clientName}</TableCell>
                      <TableCell>{getStatusBadge(proposal?.status || 'accepted')}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(conversion.mrr_value)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(proposal?.total_value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {conversion.converted_at && format(new Date(conversion.converted_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contratos da Organização</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts?.map((contract) => {
                const account = contract.accounts as { razao_social?: string; nome_fantasia?: string } | null;
                const clientName = account?.nome_fantasia || account?.razao_social || "—";
                
                return (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.title}</TableCell>
                    <TableCell className="text-muted-foreground">{clientName}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(contract.contract_value)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contract.start_date && contract.end_date
                        ? `${format(new Date(contract.start_date), "dd/MM/yy")} - ${format(new Date(contract.end_date), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {contract.created_at && formatDistanceToNow(new Date(contract.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!hasContracts && !hasSlgConversions && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum contrato ou proposta encontrada para esta organização
                  </TableCell>
                </TableRow>
              )}
              {!hasContracts && hasSlgConversions && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum contrato formal criado. Veja as propostas SLG aceitas acima.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
