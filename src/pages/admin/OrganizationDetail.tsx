import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  ArrowLeft,
  Users,
  DollarSign,
  Activity,
  FileText,
  Shield,
  Bell,
  BarChart3,
  MoreHorizontal,
  Pause,
  Play,
  CreditCard,
  User
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminKPICard } from "@/components/admin/AdminKPICard";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: org, isLoading: orgLoading } = useQuery({
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
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq("organization_id", id);
      if (error) throw error;
      return data;
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
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Impersonate
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCard className="h-4 w-4 mr-2" />
              Alterar Plano
            </DropdownMenuItem>
            {org?.status === "active" ? (
              <DropdownMenuItem className="text-amber-500">
                <Pause className="h-4 w-4 mr-2" />
                Suspender
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="text-emerald-500">
                <Play className="h-4 w-4 mr-2" />
                Reativar
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
          subtitle={`de ${org?.max_users || 5} permitidos`}
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
          <TabsTrigger value="revenue" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Receita
          </TabsTrigger>
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
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            Alertas
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
                    <span>Usuários</span>
                    <span>{members?.length || 0} / {org?.max_users || 5}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${Math.min(((members?.length || 0) / (org?.max_users || 5)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
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
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile?.avatar_url} />
                            <AvatarFallback>{member.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.profile?.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{member.profile?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.org_role)}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          {member.status || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.joined_at && formatDistanceToNow(new Date(member.joined_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
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
                        Nenhum registro de auditoria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Receita & Billing</h3>
              <p className="text-sm text-muted-foreground">
                Histórico de pagamentos e faturas em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Uso do Produto</h3>
              <p className="text-sm text-muted-foreground">
                Analytics de features mais usadas em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Alertas</h3>
              <p className="text-sm text-muted-foreground">
                Nenhum alerta ativo para esta organização.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
