import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  Search, 
  Filter, 
  MoreHorizontal,
  Users,
  Eye,
  Pause,
  Play,
  Trash2,
  DollarSign,
  Activity,
  ChevronDown,
  Clock,
  AlertTriangle,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function Organizations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [trialFilter, setTrialFilter] = useState<string>("all");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: organizations, isLoading } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get member counts for each org
      const orgsWithCounts = await Promise.all(
        (orgs || []).map(async (org) => {
          const { count: memberCount } = await supabase
            .from("organization_members")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id);

          const { count: oppCount } = await supabase
            .from("opportunities")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id);

          const { data: aiUsage } = await supabase
            .from("ai_usage_logs")
            .select("volts_used")
            .eq("organization_id", org.id);

          const totalVolts = aiUsage?.reduce((sum, log) => sum + (log.volts_used || 0), 0) || 0;

          const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
          const daysRemaining = trialEndsAt ? differenceInDays(trialEndsAt, new Date()) : null;

          return {
            ...org,
            memberCount: memberCount || 0,
            oppCount: oppCount || 0,
            totalVolts,
            usagePercent: Math.min(((oppCount || 0) / (org.max_opportunities || 100)) * 100, 100),
            daysRemaining,
            trialStatus: daysRemaining === null ? null : 
              daysRemaining <= 0 ? 'expired' : 
              daysRemaining <= 3 ? 'expiring' : 'active',
          };
        })
      );

      return orgsWithCounts;
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ orgId, currentStatus }: { orgId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' || currentStatus === 'trial' ? 'suspended' : 'active';
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("organizations")
        .update({ status: newStatus })
        .eq("id", orgId);

      if (error) throw error;

      await supabase.from("audit_log").insert({
        organization_id: orgId,
        action: newStatus === 'suspended' ? 'organization_suspended' : 'organization_reactivated',
        entity_type: 'organization',
        entity_id: orgId,
        actor_user_id: userData.user?.id,
        old_value: { status: currentStatus },
        new_value: { status: newStatus },
      });

      return newStatus;
    },
    onSuccess: (newStatus) => {
      toast.success(`Organização ${newStatus === 'suspended' ? 'suspensa' : 'reativada'}`);
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const filteredOrgs = organizations?.filter(org => {
    const matchesSearch = org.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(org.status || "");
    
    // Trial filter
    let matchesTrial = true;
    if (trialFilter === "expiring") {
      matchesTrial = org.trialStatus === 'expiring';
    } else if (trialFilter === "expired") {
      matchesTrial = org.trialStatus === 'expired';
    } else if (trialFilter === "in_trial") {
      matchesTrial = org.status === 'trial';
    }
    
    return matchesSearch && matchesStatus && matchesTrial;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativa</Badge>;
      case "trial":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Trial</Badge>;
      case "suspended":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Suspensa</Badge>;
      case "canceled":
        return <Badge className="bg-muted text-muted-foreground border-border">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status || "N/A"}</Badge>;
    }
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizações</h1>
          <p className="text-muted-foreground">
            Gerencie todas as contas e tenants do sistema
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4 cursor-pointer hover:ring-2 ring-primary/50" onClick={() => setTrialFilter("all")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{organizations?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:ring-2 ring-emerald-500/50" onClick={() => { setStatusFilter(["active"]); setTrialFilter("all"); }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{organizations?.filter(o => o.status === 'active').length || 0}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:ring-2 ring-blue-500/50" onClick={() => { setTrialFilter("in_trial"); setStatusFilter([]); }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{organizations?.filter(o => o.status === 'trial').length || 0}</p>
              <p className="text-xs text-muted-foreground">Em Trial</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:ring-2 ring-amber-500/50" onClick={() => { setTrialFilter("expiring"); setStatusFilter([]); }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{organizations?.filter(o => o.trialStatus === 'expiring').length || 0}</p>
              <p className="text-xs text-muted-foreground">Expirando (3d)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:ring-2 ring-destructive/50" onClick={() => { setStatusFilter(["suspended"]); setTrialFilter("all"); }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Pause className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{organizations?.filter(o => o.status === 'suspended').length || 0}</p>
              <p className="text-xs text-muted-foreground">Suspensas</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar organizações..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status
                  {statusFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1">
                      {statusFilter.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuCheckboxItem
                  checked={statusFilter.includes("active")}
                  onCheckedChange={() => toggleStatusFilter("active")}
                >
                  Ativa
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter.includes("trial")}
                  onCheckedChange={() => toggleStatusFilter("trial")}
                >
                  Trial
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter.includes("suspended")}
                  onCheckedChange={() => toggleStatusFilter("suspended")}
                >
                  Suspensa
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter.includes("canceled")}
                  onCheckedChange={() => toggleStatusFilter("canceled")}
                >
                  Cancelada
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {filteredOrgs?.length || 0} organizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>VOLTS</TableHead>
                <TableHead>Criação</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <div className="h-12 bg-muted/50 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredOrgs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma organização encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs?.map((org) => (
                  <TableRow 
                    key={org.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/organizations/${org.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">{org.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(org.status)}</TableCell>
                    <TableCell>
                      {org.status === 'trial' && org.daysRemaining !== null ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-3.5 w-3.5 ${
                            org.daysRemaining <= 0 ? 'text-destructive' :
                            org.daysRemaining <= 3 ? 'text-amber-500' :
                            'text-muted-foreground'
                          }`} />
                          <span className={`text-sm font-mono ${
                            org.daysRemaining <= 0 ? 'text-destructive font-bold' :
                            org.daysRemaining <= 3 ? 'text-amber-500 font-semibold' : ''
                          }`}>
                            {org.daysRemaining <= 0 ? 'Expirado' : `${org.daysRemaining}d`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.current_plan_id || "Free"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{org.memberCount}/{org.max_users || 5}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{org.totalVolts.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(org.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/organizations/${org.id}`);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {org.status === "suspended" ? (
                            <DropdownMenuItem 
                              className="text-emerald-500" 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStatusMutation.mutate({ orgId: org.id, currentStatus: org.status || '' });
                              }}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Reativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="text-amber-500" 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStatusMutation.mutate({ orgId: org.id, currentStatus: org.status || '' });
                              }}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Suspender
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
