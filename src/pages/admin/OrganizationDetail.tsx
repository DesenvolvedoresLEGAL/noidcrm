import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  ArrowLeft,
  Users,
  Activity,
  FileText,
  Shield,
  Bell,
  BarChart3,
  MoreHorizontal,
  Pause,
  Play,
  CreditCard,
  User,
  Clock,
  Unlock,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminKPICard } from "@/components/admin/AdminKPICard";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChangePlanDialog } from "@/components/admin/dialogs/ChangePlanDialog";
import { ExtendTrialDialog } from "@/components/admin/dialogs/ExtendTrialDialog";
import { TrialInfoCard } from "@/components/admin/TrialInfoCard";
import { OrganizationContractsTab } from "@/components/admin/OrganizationContractsTab";

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showExtendTrialDialog, setShowExtendTrialDialog] = useState(false);

  const { data: org, isLoading: orgLoading, refetch } = useQuery({
    queryKey: ["admin-organization", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["admin-org-members", id],
    queryFn: async () => {
      // Buscar membros da organização
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", id);
      if (membersError) throw membersError;
      if (!membersData || membersData.length === 0) return [];

      // Buscar profiles dos membros
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, avatar_url")
        .in("user_id", userIds);
      if (profilesError) throw profilesError;

      // Combinar dados
      return membersData.map(member => {
        const profile = profiles?.find(p => p.user_id === member.user_id);
        return {
          ...member,
          profile: profile || null
        };
      });
    },
    enabled: !!id,
  });

  const { data: opportunities } = useQuery({
    queryKey: ["admin-org-opportunities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, status")
        .eq("organization_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activities } = useQuery({
    queryKey: ["admin-org-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, type, created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["admin-org-audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: aiUsage } = useQuery({
    queryKey: ["admin-org-ai-usage", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("volts_used, feature, created_at")
        .eq("organization_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = org?.status === 'active' || org?.status === 'trial' ? 'suspended' : 'active';
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("organizations")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Log the action
      await supabase.from("audit_log").insert({
        organization_id: id,
        action: newStatus === 'suspended' ? 'organization_suspended' : 'organization_reactivated',
        entity_type: 'organization',
        entity_id: id,
        actor_user_id: userData.user?.id,
        old_value: { status: org?.status },
        new_value: { status: newStatus },
      });

      return newStatus;
    },
    onSuccess: (newStatus) => {
      toast.success(`Organização ${newStatus === 'suspended' ? 'suspensa' : 'reativada'} com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["admin-organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Impersonate function
  const handleImpersonate = async () => {
    // Find the owner of the organization
    const ownerMember = members?.find((m: any) => m.org_role === 'owner');
    if (!ownerMember) {
      toast.error("Nenhum owner encontrado para esta organização");
      return;
    }

    // For now, we'll just show the user info - full impersonation requires additional setup
    const profile = ownerMember.profile as any;
    toast.info(
      `Para impersonar, faça login com o email: ${profile?.email || 'N/A'}`,
      { duration: 5000 }
    );
    
    // Log the impersonation attempt
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      organization_id: id,
      action: 'impersonation_requested',
      entity_type: 'organization',
      entity_id: id,
      actor_user_id: userData.user?.id,
      metadata: { target_user_id: ownerMember.user_id },
    });
  };

  const totalVolts = aiUsage?.reduce((sum, log) => sum + (log.volts_used || 0), 0) || 0;
  const totalOpps = opportunities?.length || 0;
  const wonOpps = opportunities?.filter(o => o.status === 'won').length || 0;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativa</Badge>;
      case "trial":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Trial</Badge>;
      case "suspended":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Suspensa</Badge>;
      default:
        return <Badge variant="secondary">{status || "N/A"}</Badge>;
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "owner":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Owner</Badge>;
      case "admin":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Admin</Badge>;
      case "manager":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Manager</Badge>;
      default:
        return <Badge variant="secondary">{role || "User"}</Badge>;
    }
  };

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/organizations")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{org?.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(org?.status)}
                <span className="text-sm text-muted-foreground">
                  Criada {org?.created_at && formatDistanceToNow(new Date(org.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              Ações
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleImpersonate}>
              <User className="h-4 w-4 mr-2" />
              Impersonate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowChangePlanDialog(true)}>
              <CreditCard className="h-4 w-4 mr-2" />
              Alterar Plano
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowExtendTrialDialog(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Estender Trial
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {org?.status === "suspended" ? (
              <DropdownMenuItem 
                className="text-emerald-500"
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Reativar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                className="text-amber-500"
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspender
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminKPICard
          title="Usuários"
          value={members?.length || 0}
          subtitle="ativos"
          icon={Users}
          variant="info"
        />
        <AdminKPICard
          title="Oportunidades"
          value={totalOpps}
          subtitle={`${wonOpps} ganhas`}
          icon={BarChart3}
        />
        <AdminKPICard
          title="VOLTS Consumidos"
          value={totalVolts.toLocaleString()}
          subtitle="Ações de IA"
          icon={Activity}
          variant="warning"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          {/* Only show Trial tab for organizations in trial status */}
          {org?.status === 'trial' && (
            <TabsTrigger value="trial" className="gap-2">
              <Clock className="h-4 w-4" />
              Trial
            </TabsTrigger>
          )}
          <TabsTrigger value="usage" className="gap-2">
            <Activity className="h-4 w-4" />
            Uso
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Shield className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Contratos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações da Conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-sm">{org?.id?.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {getStatusBadge(org?.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano</span>
                  <Badge variant="outline">{org?.current_plan_id || "Free"}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ</span>
                  <span>{org?.cnpj || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criação</span>
                  <span>{org?.created_at && format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Limites & Quotas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Oportunidades</span>
                    <span>{totalOpps} / {org?.max_opportunities || "∞"}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: org?.max_opportunities ? `${Math.min((totalOpps / org.max_opportunities) * 100, 100)}%` : "10%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>VOLTS (IA)</span>
                    <span>{totalVolts.toLocaleString()} / 10.000</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full" 
                      style={{ width: `${Math.min((totalVolts / 10000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trial" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {org && (
              <TrialInfoCard organization={org} />
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Alterações do Trial</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs?.filter(log => 
                      log.action?.includes('trial') || 
                      log.action?.includes('plan') ||
                      log.action?.includes('unblock')
                    ).slice(0, 10).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.metadata && typeof log.metadata === 'object' 
                            ? (log.metadata as any).reason || (log.metadata as any).justification || "—"
                            : "—"
                          }
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!auditLogs?.filter(log => 
                      log.action?.includes('trial') || 
                      log.action?.includes('plan') ||
                      log.action?.includes('unblock')
                    ).length && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Nenhuma alteração de trial registrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuários ({members?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members && members.length > 0 ? (
                    members.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile?.avatar_url} />
                              <AvatarFallback>{member.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.profile?.full_name || "Usuário"}</p>
                              <p className="text-xs text-muted-foreground">{member.profile?.email || "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {member.profile?.phone || "—"}
                        </TableCell>
                        <TableCell>{getRoleBadge(member.org_role)}</TableCell>
                        <TableCell>
                          <Badge className={member.status === 'active' 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                          }>
                            {member.status || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {member.joined_at && formatDistanceToNow(new Date(member.joined_at), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado nesta organização
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities?.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">{activity.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{activity.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!activities?.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhuma atividade recente
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log de Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.entity_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.field_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!auditLogs?.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum log de auditoria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uso de IA (VOLTS)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>VOLTS</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiUsage?.slice(0, 20).map((usage, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{usage.feature}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{usage.volts_used || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {usage.created_at && formatDistanceToNow(new Date(usage.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!aiUsage?.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum uso de IA registrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          {id && <OrganizationContractsTab organizationId={id} organizationName={org?.name} />}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {org && (
        <>
          <ChangePlanDialog
            open={showChangePlanDialog}
            onOpenChange={setShowChangePlanDialog}
            organization={org}
          />
          <ExtendTrialDialog
            open={showExtendTrialDialog}
            onOpenChange={setShowExtendTrialDialog}
            organization={org}
          />
        </>
      )}
    </div>
  );
}
