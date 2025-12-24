import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Building2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminContract {
  id: string;
  title: string;
  status: string;
  contract_value: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  organization_id: string;
  organization_name: string;
  client_name: string;
}

export default function AdminContracts() {
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<AdminContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [contracts, searchTerm, statusFilter, orgFilter]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch all contracts with organization and account info
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          title,
          status,
          contract_value,
          start_date,
          end_date,
          created_at,
          organization_id,
          organizations!organization_id (
            name
          ),
          accounts:account_id (
            razao_social,
            nome_fantasia
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedContracts: AdminContract[] = (data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        contract_value: Number(c.contract_value) || 0,
        start_date: c.start_date,
        end_date: c.end_date,
        created_at: c.created_at,
        organization_id: c.organization_id,
        organization_name: c.organizations?.name || 'Org Desconhecida',
        client_name: c.accounts?.nome_fantasia || c.accounts?.razao_social || 'Cliente Desconhecido',
      }));

      setContracts(mappedContracts);

      // Extract unique organizations for filter
      const uniqueOrgs = Array.from(
        new Map(mappedContracts.map(c => [c.organization_id, { id: c.organization_id, name: c.organization_name }])).values()
      );
      setOrganizations(uniqueOrgs);

    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...contracts];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(search) ||
        c.client_name.toLowerCase().includes(search) ||
        c.organization_name.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (orgFilter !== "all") {
      filtered = filtered.filter(c => c.organization_id === orgFilter);
    }

    setFilteredContracts(filtered);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  function formatDate(date: string | null) {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: 'Rascunho', variant: 'outline' },
      pending: { label: 'Pendente', variant: 'secondary' },
      active: { label: 'Ativo', variant: 'default' },
      expiring: { label: 'Expirando', variant: 'secondary' },
      expired: { label: 'Expirado', variant: 'destructive' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
      renewed: { label: 'Renovado', variant: 'default' },
    };
    const config = variants[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  // Calculate stats
  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    totalValue: contracts.reduce((sum, c) => sum + c.contract_value, 0),
    orgsWithContracts: organizations.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos - Visão Global</h1>
          <p className="text-muted-foreground">
            Todos os contratos de todas as organizações
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">Ativos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Organizações</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.orgsWithContracts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Valor Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, cliente ou organização..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expiring">Expirando</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="renewed">Renovado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Organizações</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alert about global view */}
      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm text-amber-600 dark:text-amber-400">
          Visão administrativa global - Mostrando contratos de todas as organizações
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Contratos ({filteredContracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum contrato encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {contract.organization_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {contract.client_name}
                    </TableCell>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(contract.contract_value)}
                    </TableCell>
                    <TableCell>{formatDate(contract.start_date)}</TableCell>
                    <TableCell>{formatDate(contract.end_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
