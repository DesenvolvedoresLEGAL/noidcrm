import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, Search, Download, Eye, User, Clock, MapPin,
  FileText, AlertTriangle, Lock, Trash2, Database, Settings,
  CheckCircle, XCircle, ArrowRight
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditEntry {
  id: string;
  timestamp: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  organization_id?: string;
  organization_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  old_value?: unknown;
  new_value?: unknown;
  severity: string;
  metadata?: Record<string, unknown>;
}

export default function Audit() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");

  // Fetch audit logs
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", actionFilter, entityFilter, timeRange],
    queryFn: async () => {
      const startDate = timeRange === "24h" 
        ? subDays(new Date(), 1) 
        : timeRange === "7d" 
          ? subDays(new Date(), 7) 
          : subDays(new Date(), 30);

      // Fetch security audit logs with user info
      const { data: securityLogs } = await supabase
        .from("security_audit_log")
        .select(`
          *,
          profiles:user_id(full_name, email),
          organizations:organization_id(name)
        `)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      // Fetch regular audit logs
      const { data: regularLogs } = await supabase
        .from("audit_log")
        .select(`
          *,
          profiles:actor_user_id(full_name, email),
          organizations:organization_id(name)
        `)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      const allLogs: AuditEntry[] = [];

      // Process security logs
      (securityLogs || []).forEach(log => {
        allLogs.push({
          id: log.id,
          timestamp: log.created_at,
          user_id: log.user_id || "",
          user_name: (log.profiles as any)?.full_name,
          user_email: (log.profiles as any)?.email,
          organization_id: log.organization_id || undefined,
          organization_name: (log.organizations as any)?.name,
          action: log.action,
          entity_type: log.entity_type || "system",
          entity_id: log.entity_id || undefined,
          ip_address: (log.ip_address as string) || undefined,
          user_agent: log.user_agent || undefined,
          severity: log.severity || "info",
          metadata: log.metadata as Record<string, unknown> || {},
        });
      });

      // Process regular audit logs
      (regularLogs || []).forEach(log => {
        allLogs.push({
          id: log.id,
          timestamp: log.created_at || new Date().toISOString(),
          user_id: log.actor_user_id || "",
          user_name: (log.profiles as any)?.full_name,
          user_email: (log.profiles as any)?.email,
          organization_id: log.organization_id || undefined,
          organization_name: (log.organizations as any)?.name,
          action: log.action,
          entity_type: log.entity_type || "unknown",
          entity_id: log.entity_id || undefined,
          old_value: log.old_value,
          new_value: log.new_value,
          severity: "info",
          metadata: log.metadata as Record<string, unknown> || {},
        });
      });

      // Sort by timestamp
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return allLogs;
    },
    staleTime: 60 * 1000,
  });

  const filteredLogs = (auditLogs || []).filter(log => {
    if (actionFilter !== "all" && !log.action.toLowerCase().includes(actionFilter)) return false;
    if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return log.action.toLowerCase().includes(search) ||
             log.user_name?.toLowerCase().includes(search) ||
             log.user_email?.toLowerCase().includes(search) ||
             log.entity_id?.toLowerCase().includes(search);
    }
    return true;
  });

  // Get unique entity types for filter
  const entityTypes = [...new Set((auditLogs || []).map(l => l.entity_type))].filter(Boolean);

  const getActionIcon = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes("delete") || lower.includes("removed")) 
      return <Trash2 className="h-4 w-4 text-red-500" />;
    if (lower.includes("update") || lower.includes("changed")) 
      return <Settings className="h-4 w-4 text-blue-500" />;
    if (lower.includes("create") || lower.includes("insert")) 
      return <FileText className="h-4 w-4 text-green-500" />;
    if (lower.includes("login") || lower.includes("auth")) 
      return <Lock className="h-4 w-4 text-purple-500" />;
    if (lower.includes("export")) 
      return <Download className="h-4 w-4 text-orange-500" />;
    return <Database className="h-4 w-4 text-muted-foreground" />;
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      info: "bg-blue-500/10 text-blue-600",
      warning: "bg-yellow-500/10 text-yellow-600",
      error: "bg-red-500/10 text-red-600",
      critical: "bg-purple-500/10 text-purple-600",
    };
    return <Badge className={styles[severity] || styles.info}>{severity}</Badge>;
  };

  const handleExport = (exportFormat: "csv" | "json") => {
    const data = filteredLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      user: log.user_name || log.user_email || log.user_id,
      organization: log.organization_name || log.organization_id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      ip_address: log.ip_address,
      severity: log.severity,
    }));

    if (exportFormat === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
    } else {
      const headers = Object.keys(data[0] || {}).join(",");
      const rows = data.map(row => Object.values(row).map(v => `"${v || ""}"`).join(","));
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
    }
  };

  // Statistics
  const stats = {
    total: auditLogs?.length || 0,
    sensitiveChanges: auditLogs?.filter(l => 
      l.action.toLowerCase().includes("delete") || 
      l.severity === "warning" || 
      l.severity === "critical"
    ).length || 0,
    uniqueUsers: new Set(auditLogs?.map(l => l.user_id)).size,
    dataExports: auditLogs?.filter(l => l.action.toLowerCase().includes("export")).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditoria & Compliance</h1>
          <p className="text-muted-foreground">Trilha de auditoria imutável e compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Shield className="h-4 w-4" />
              Total de Eventos
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              Alterações Sensíveis
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.sensitiveChanges}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <User className="h-4 w-4" />
              Usuários Únicos
            </div>
            <p className="text-2xl font-bold mt-1">{stats.uniqueUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Download className="h-4 w-4" />
              Exportações
            </div>
            <p className="text-2xl font-bold mt-1">{stats.dataExports}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Trilha de Auditoria</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por usuário, ação..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <SelectItem value="create">Criações</SelectItem>
                    <SelectItem value="update">Alterações</SelectItem>
                    <SelectItem value="delete">Exclusões</SelectItem>
                    <SelectItem value="export">Exportações</SelectItem>
                    <SelectItem value="login">Login/Auth</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Entidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {entityTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Últimas 24h</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Audit Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Quando</TableHead>
                    <TableHead className="w-[180px]">Quem</TableHead>
                    <TableHead>O que</TableHead>
                    <TableHead className="w-[120px]">Entidade</TableHead>
                    <TableHead className="w-[100px]">De onde</TableHead>
                    <TableHead className="w-[80px]">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando auditoria...
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.slice(0, 100).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(log.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-3 w-3" />
                            </div>
                            <div className="text-xs">
                              <p className="font-medium truncate max-w-[120px]">
                                {log.user_name || "Sistema"}
                              </p>
                              <p className="text-muted-foreground truncate max-w-[120px]">
                                {log.user_email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <span className="text-sm">{log.action}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {log.entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.ip_address ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{log.ip_address}</span>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Detalhes do Evento</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">ID</p>
                                    <p className="font-mono text-xs">{log.id}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Timestamp</p>
                                    <p className="text-sm">
                                      {format(new Date(log.timestamp), "PPpp", { locale: ptBR })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Usuário</p>
                                    <p>{log.user_name || log.user_email || "Sistema"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Organização</p>
                                    <p>{log.organization_name || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Ação</p>
                                    <div className="flex items-center gap-2">
                                      {getActionIcon(log.action)}
                                      <span>{log.action}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Severidade</p>
                                    {getSeverityBadge(log.severity)}
                                  </div>
                                  {log.ip_address && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">IP</p>
                                      <p className="font-mono text-xs">{log.ip_address}</p>
                                    </div>
                                  )}
                                  {log.entity_id && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">Entity ID</p>
                                      <p className="font-mono text-xs">{log.entity_id}</p>
                                    </div>
                                  )}
                                </div>

                                {(log.old_value || log.new_value) && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Antes vs Depois</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                                        <p className="text-xs text-red-600 mb-1">Antes</p>
                                        <pre className="text-xs overflow-auto">
                                          {JSON.stringify(log.old_value, null, 2) || "-"}
                                        </pre>
                                      </div>
                                      <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                                        <p className="text-xs text-green-600 mb-1">Depois</p>
                                        <pre className="text-xs overflow-auto">
                                          {JSON.stringify(log.new_value, null, 2) || "-"}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {log.user_agent && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">User Agent</p>
                                    <p className="text-xs p-2 bg-muted rounded font-mono">
                                      {log.user_agent}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LGPD Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  LGPD Compliance
                </CardTitle>
                <CardDescription>
                  Conformidade com a Lei Geral de Proteção de Dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso geral</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Consentimento registrado</span>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600">OK</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Logs de auditoria imutáveis</span>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600">OK</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Criptografia em repouso</span>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600">OK</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Política de retenção</span>
                    </div>
                    <Badge className="bg-yellow-500/10 text-yellow-600">Pendente</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Retention */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  Retenção de Dados
                </CardTitle>
                <CardDescription>
                  Políticas de retenção e limpeza
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Logs de Auditoria</p>
                      <p className="text-xs text-muted-foreground">Imutáveis por regulação</p>
                    </div>
                    <Badge>7 anos</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Logs de Sistema</p>
                      <p className="text-xs text-muted-foreground">Performance e debug</p>
                    </div>
                    <Badge>90 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Sessões de Usuário</p>
                      <p className="text-xs text-muted-foreground">Dados de analytics</p>
                    </div>
                    <Badge>30 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Backups</p>
                      <p className="text-xs text-muted-foreground">Point-in-time recovery</p>
                    </div>
                    <Badge>30 dias</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Anonymization */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-5 w-5 text-purple-500" />
                  Anonimização de Dados
                </CardTitle>
                <CardDescription>
                  Ferramentas para LGPD - Direito ao esquecimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Exportar Dados</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Exportar todos os dados de um usuário (portabilidade)
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Anonimizar</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Substituir dados pessoais por valores anônimos
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        <Lock className="h-4 w-4 mr-2" />
                        Anonimizar
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Excluir</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Remover permanentemente dados pessoais
                      </p>
                      <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações de Auditoria</CardTitle>
              <CardDescription>
                Configure políticas de retenção e alertas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auditoria Ativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Registrar todas as ações sensíveis
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Alertas de Segurança</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar admins sobre ações críticas
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Capturar IP</Label>
                  <p className="text-sm text-muted-foreground">
                    Registrar endereço IP das ações
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Registrar User Agent</Label>
                  <p className="text-sm text-muted-foreground">
                    Capturar informações do navegador
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="pt-4 border-t">
                <Label>Período de Retenção</Label>
                <Select defaultValue="7years">
                  <SelectTrigger className="w-[200px] mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1year">1 ano</SelectItem>
                    <SelectItem value="3years">3 anos</SelectItem>
                    <SelectItem value="5years">5 anos</SelectItem>
                    <SelectItem value="7years">7 anos (LGPD)</SelectItem>
                    <SelectItem value="forever">Permanente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
