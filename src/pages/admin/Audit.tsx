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
  CheckCircle, XCircle, ArrowRight, Globe, Monitor, UserCog,
  AlertCircle, RefreshCw, History
} from "lucide-react";
import { format, subDays, subHours } from "date-fns";
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
  is_critical: boolean;
}

// Critical actions that need special attention
const CRITICAL_ACTIONS = [
  'opportunity_deleted',
  'account_deleted',
  'contact_deleted',
  'user_deleted',
  'organization_suspended',
  'owner_changed',
  'field_updated', // When owner_user_id changes
  'role_changed',
  'permission_changed',
  'bulk_delete',
  'data_export',
  'api_key_created',
  'api_key_deleted',
  'password_reset',
  'mfa_disabled',
];

const CRITICAL_FIELDS = ['owner_user_id', 'org_role', 'permissions', 'status'];

function isCriticalAction(action: string, metadata?: Record<string, unknown>): boolean {
  const lowerAction = action.toLowerCase();
  
  // Check direct critical actions
  if (CRITICAL_ACTIONS.some(ca => lowerAction.includes(ca.toLowerCase()))) {
    return true;
  }
  
  // Check if it's a field update on critical fields
  if (lowerAction.includes('update') || lowerAction.includes('changed')) {
    const fieldName = metadata?.field_name as string;
    if (fieldName && CRITICAL_FIELDS.includes(fieldName)) {
      return true;
    }
  }
  
  // Delete actions are always critical
  if (lowerAction.includes('delete') || lowerAction.includes('removed')) {
    return true;
  }
  
  return false;
}

export default function Audit() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [organizationFilter, setOrganizationFilter] = useState("all");

  // Fetch audit logs
  const { data: auditLogs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-audit-logs", actionFilter, entityFilter, timeRange],
    queryFn: async () => {
      const startDate = timeRange === "1h"
        ? subHours(new Date(), 1)
        : timeRange === "24h" 
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
        .limit(500);

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
        .limit(500);

      const allLogs: AuditEntry[] = [];

      // Process security logs
      (securityLogs || []).forEach(log => {
        const metadata = log.metadata as Record<string, unknown> || {};
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
          user_agent: log.user_agent || metadata.user_agent as string || undefined,
          severity: log.severity || "info",
          metadata,
          is_critical: isCriticalAction(log.action, metadata),
        });
      });

      // Process regular audit logs
      (regularLogs || []).forEach(log => {
        const metadata = log.metadata as Record<string, unknown> || {};
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
          user_agent: metadata.user_agent as string || undefined,
          old_value: log.old_value,
          new_value: log.new_value,
          severity: "info",
          metadata,
          is_critical: isCriticalAction(log.action, metadata),
        });
      });

      // Sort by timestamp
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return allLogs;
    },
    staleTime: 30 * 1000,
  });

  const filteredLogs = (auditLogs || []).filter(log => {
    if (criticalOnly && !log.is_critical) return false;
    if (actionFilter !== "all" && !log.action.toLowerCase().includes(actionFilter)) return false;
    if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
    if (organizationFilter !== "all" && log.organization_id !== organizationFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return log.action.toLowerCase().includes(search) ||
             log.user_name?.toLowerCase().includes(search) ||
             log.user_email?.toLowerCase().includes(search) ||
             log.entity_id?.toLowerCase().includes(search) ||
             log.organization_name?.toLowerCase().includes(search);
    }
    return true;
  });

  // Get unique entity types and organizations for filters
  const entityTypes = [...new Set((auditLogs || []).map(l => l.entity_type))].filter(Boolean);
  const organizations = [...new Set((auditLogs || []).map(l => ({ id: l.organization_id, name: l.organization_name })))]
    .filter(o => o.id && o.name) as { id: string; name: string }[];
  const uniqueOrgs = organizations.reduce((acc, org) => {
    if (!acc.find(o => o.id === org.id)) acc.push(org);
    return acc;
  }, [] as { id: string; name: string }[]);

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
    criticalActions: auditLogs?.filter(l => l.is_critical).length || 0,
    sensitiveChanges: auditLogs?.filter(l => 
      l.action.toLowerCase().includes("delete") || 
      l.action.toLowerCase().includes("owner") ||
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Auditoria & Compliance
          </h1>
          <p className="text-muted-foreground">Trilha de auditoria imutável e compliance</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Shield className="h-4 w-4" />
              Total de Eventos
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="h-4 w-4" />
              Ações Críticas
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.criticalActions}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              Alt. Sensíveis
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
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por usuário, ação, organização..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                {/* Critical Only Toggle */}
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-red-500/5">
                  <Switch
                    id="critical-only"
                    checked={criticalOnly}
                    onCheckedChange={setCriticalOnly}
                  />
                  <Label htmlFor="critical-only" className="text-sm font-medium cursor-pointer">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      Críticas
                    </span>
                  </Label>
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
                    <SelectItem value="owner">Troca de Dono</SelectItem>
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
                {uniqueOrgs.length > 1 && (
                  <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Organização" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas organizações</SelectItem>
                      {uniqueOrgs.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Última hora</SelectItem>
                    <SelectItem value="24h">Últimas 24h</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Active filters summary */}
              {(criticalOnly || actionFilter !== 'all' || entityFilter !== 'all' || organizationFilter !== 'all') && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                  {criticalOnly && (
                    <Badge variant="destructive" className="text-xs">Críticas</Badge>
                  )}
                  {actionFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs">{actionFilter}</Badge>
                  )}
                  {entityFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs">{entityFilter}</Badge>
                  )}
                  {organizationFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      {uniqueOrgs.find(o => o.id === organizationFilter)?.name}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      setCriticalOnly(false);
                      setActionFilter('all');
                      setEntityFilter('all');
                      setOrganizationFilter('all');
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Exibindo {Math.min(filteredLogs.length, 100)} de {filteredLogs.length} registros
              {criticalOnly && ` (${stats.criticalActions} críticos no total)`}
            </span>
          </div>

          {/* Audit Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Quando</TableHead>
                    <TableHead className="w-[180px]">Quem</TableHead>
                    <TableHead>O que</TableHead>
                    <TableHead className="w-[120px]">Entidade</TableHead>
                    <TableHead className="w-[140px]">Organização</TableHead>
                    <TableHead className="w-[80px]">Contexto</TableHead>
                    <TableHead className="w-[70px]">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Carregando auditoria...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.slice(0, 100).map((log) => (
                      <TableRow 
                        key={log.id}
                        className={log.is_critical ? "bg-red-500/5 hover:bg-red-500/10" : ""}
                      >
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(log.timestamp), "dd/MM HH:mm:ss", { locale: ptBR })}
                            </div>
                            {log.is_critical && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0 w-fit">
                                CRÍTICO
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                              log.is_critical ? 'bg-red-500/20' : 'bg-primary/10'
                            }`}>
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
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{log.action}</span>
                              {log.metadata?.opportunity_title && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {String(log.metadata.opportunity_title)}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-xs w-fit">
                              {log.entity_type}
                            </Badge>
                            {log.entity_id && (
                              <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                                {log.entity_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.organization_name ? (
                            <span className="truncate max-w-[120px] block" title={log.organization_name}>
                              {log.organization_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.metadata?.page_url || log.user_agent ? (
                            <div className="flex items-center gap-1" title={log.metadata?.page_url as string || log.user_agent}>
                              {log.metadata?.page_url ? (
                                <Globe className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <Monitor className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="truncate max-w-[80px]">
                                {log.metadata?.page_url 
                                  ? new URL(log.metadata.page_url as string).pathname.slice(0, 15)
                                  : 'Browser'
                                }
                              </span>
                            </div>
                          ) : log.ip_address ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{log.ip_address}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                                {/* Critical Badge */}
                                {log.is_critical && (
                                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                    <span className="font-medium text-red-600">Ação Crítica</span>
                                  </div>
                                )}

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

                                {/* Client Context Section */}
                                {(log.metadata?.page_url || log.metadata?.referrer || log.metadata?.timezone) && (
                                  <div>
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <Monitor className="h-4 w-4" />
                                      Contexto do Cliente
                                    </p>
                                    <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                                      {log.metadata?.page_url && (
                                        <div className="flex items-start gap-2">
                                          <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Página</p>
                                            <p className="font-mono text-xs break-all">{String(log.metadata.page_url)}</p>
                                          </div>
                                        </div>
                                      )}
                                      {log.metadata?.referrer && log.metadata.referrer !== 'direct' && (
                                        <div className="flex items-start gap-2">
                                          <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Veio de</p>
                                            <p className="font-mono text-xs break-all">{String(log.metadata.referrer)}</p>
                                          </div>
                                        </div>
                                      )}
                                      {log.metadata?.timezone && (
                                        <div className="flex items-start gap-2">
                                          <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Timezone</p>
                                            <p className="text-xs">{String(log.metadata.timezone)}</p>
                                          </div>
                                        </div>
                                      )}
                                      {log.metadata?.client_timestamp && (
                                        <div className="flex items-start gap-2">
                                          <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Hora do Cliente</p>
                                            <p className="text-xs">
                                              {format(new Date(String(log.metadata.client_timestamp)), "PPpp", { locale: ptBR })}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                      {log.metadata?.screen_resolution && (
                                        <div className="flex items-start gap-2">
                                          <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-xs text-muted-foreground">Resolução</p>
                                            <p className="text-xs">{String(log.metadata.screen_resolution)}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {(log.old_value || log.new_value) && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Antes vs Depois</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                                        <p className="text-xs text-red-600 mb-1">Antes</p>
                                        <pre className="text-xs overflow-auto max-h-32">
                                          {JSON.stringify(log.old_value, null, 2) || "-"}
                                        </pre>
                                      </div>
                                      <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                                        <p className="text-xs text-green-600 mb-1">Depois</p>
                                        <pre className="text-xs overflow-auto max-h-32">
                                          {JSON.stringify(log.new_value, null, 2) || "-"}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {log.user_agent && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">User Agent</p>
                                    <p className="text-xs p-2 bg-muted rounded font-mono break-all">
                                      {log.user_agent}
                                    </p>
                                  </div>
                                )}

                                {/* Full Metadata */}
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Metadados Completos</p>
                                    <ScrollArea className="h-40">
                                      <pre className="text-xs p-2 bg-muted rounded font-mono">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    </ScrollArea>
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
