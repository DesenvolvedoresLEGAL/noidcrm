import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, Search, Filter, Download, RefreshCw, Eye,
  AlertTriangle, Info, AlertCircle, Bug, Zap, Bot, Play
} from "lucide-react";
import { format, subDays, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";

type LogSeverity = "info" | "warning" | "error" | "critical";

interface LogEntry {
  id: string;
  timestamp: string;
  type: string;
  severity: LogSeverity;
  source: string;
  message: string;
  user_id?: string;
  organization_id?: string;
  metadata?: Record<string, unknown>;
}

export default function Logs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Fetch logs from multiple sources
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-logs", severityFilter, typeFilter, timeRange],
    queryFn: async () => {
      const now = new Date();
      const startDate = timeRange === "1h" 
        ? subHours(now, 1) 
        : timeRange === "24h" 
          ? subDays(now, 1) 
          : timeRange === "7d" 
            ? subDays(now, 7) 
            : subDays(now, 30);

      const allLogs: LogEntry[] = [];

      // Fetch workflow executions as automation logs
      const { data: workflowLogs } = await supabase
        .from("workflow_executions")
        .select(`
          id, created_at, status, trigger_type, trigger_data, error_message,
          organization_id, opportunity_id
        `)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      (workflowLogs || []).forEach(log => {
        allLogs.push({
          id: log.id,
          timestamp: log.created_at,
          type: "automation",
          severity: log.status === "failed" ? "error" : log.status === "pending" ? "warning" : "info",
          source: "workflow",
          message: `Workflow ${log.trigger_type}: ${log.status}`,
          organization_id: log.organization_id,
          metadata: { trigger_data: log.trigger_data, error: log.error_message }
        });
      });

      // Fetch AI usage logs
      const { data: aiLogs } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      (aiLogs || []).forEach(log => {
        allLogs.push({
          id: log.id,
          timestamp: log.created_at,
          type: "ai",
          severity: log.success ? "info" : "error",
          source: log.feature,
          message: `${log.action} (${log.model_used})`,
          user_id: log.user_id || undefined,
          organization_id: log.organization_id,
          metadata: { 
            tokens: log.tokens_total, 
            latency: log.latency_ms,
            error: log.error_message 
          }
        });
      });

      // Fetch audit logs as activity logs
      const { data: auditLogs } = await supabase
        .from("audit_log")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      (auditLogs || []).forEach(log => {
        allLogs.push({
          id: log.id,
          timestamp: log.created_at || new Date().toISOString(),
          type: "api",
          severity: "info",
          source: log.entity_type || "unknown",
          message: `${log.action} on ${log.entity_type}`,
          user_id: log.actor_user_id || undefined,
          organization_id: log.organization_id || undefined,
          metadata: { 
            entity_id: log.entity_id, 
            field: log.field_name,
            old_value: log.old_value,
            new_value: log.new_value
          }
        });
      });

      // Fetch security audit logs
      const { data: securityLogs } = await supabase
        .from("security_audit_log")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      (securityLogs || []).forEach(log => {
        allLogs.push({
          id: log.id,
          timestamp: log.created_at,
          type: "security",
          severity: log.severity === "critical" ? "critical" : 
                   log.severity === "warning" ? "warning" : "info",
          source: log.entity_type || "security",
          message: log.action,
          user_id: log.user_id || undefined,
          organization_id: log.organization_id || undefined,
          metadata: { 
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            ...((log.metadata || {}) as Record<string, unknown>)
          }
        });
      });

      // Sort by timestamp
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return allLogs;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const filteredLogs = (logs || []).filter(log => {
    if (severityFilter !== "all" && log.severity !== severityFilter) return false;
    if (typeFilter !== "all" && log.type !== typeFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return log.message.toLowerCase().includes(search) ||
             log.source.toLowerCase().includes(search) ||
             log.id.toLowerCase().includes(search);
    }
    return true;
  });

  const getSeverityBadge = (severity: LogSeverity) => {
    const styles = {
      info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      warning: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      error: "bg-red-500/10 text-red-600 border-red-500/20",
      critical: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    };
    return <Badge className={styles[severity]}>{severity.toUpperCase()}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "automation": return <Zap className="h-4 w-4 text-yellow-500" />;
      case "ai": return <Bot className="h-4 w-4 text-purple-500" />;
      case "api": return <FileText className="h-4 w-4 text-blue-500" />;
      case "security": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleExport = () => {
    const csv = [
      ["ID", "Timestamp", "Type", "Severity", "Source", "Message"].join(","),
      ...filteredLogs.map(log => [
        log.id,
        log.timestamp,
        log.type,
        log.severity,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
    a.click();
  };

  // Log statistics
  const stats = {
    total: logs?.length || 0,
    errors: logs?.filter(l => l.severity === "error" || l.severity === "critical").length || 0,
    warnings: logs?.filter(l => l.severity === "warning").length || 0,
    automations: logs?.filter(l => l.type === "automation").length || 0,
    aiCalls: logs?.filter(l => l.type === "ai").length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs & Observabilidade</h1>
          <p className="text-muted-foreground">Logs centralizados de todas as operações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="h-4 w-4" />
              Total
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="h-4 w-4" />
              Erros
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.errors}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              Warnings
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.warnings}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Automações
            </div>
            <p className="text-2xl font-bold mt-1">{stats.automations}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Bot className="h-4 w-4" />
              IA Calls
            </div>
            <p className="text-2xl font-bold mt-1">{stats.aiCalls}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="automation">Automação</SelectItem>
                <SelectItem value="ai">IA</SelectItem>
                <SelectItem value="security">Segurança</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
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
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
                <TableHead className="w-[100px]">Severidade</TableHead>
                <TableHead className="w-[120px]">Fonte</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.slice(0, 100).map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.timestamp), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(log.type)}
                        <span className="text-xs capitalize">{log.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                    <TableCell className="text-xs">{log.source}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">
                      {log.message}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Log</DialogTitle>
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
                                <p className="text-sm text-muted-foreground">Tipo</p>
                                <div className="flex items-center gap-2">
                                  {getTypeIcon(log.type)}
                                  <span className="capitalize">{log.type}</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Severidade</p>
                                {getSeverityBadge(log.severity)}
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Fonte</p>
                                <p>{log.source}</p>
                              </div>
                              {log.user_id && (
                                <div>
                                  <p className="text-sm text-muted-foreground">User ID</p>
                                  <p className="font-mono text-xs">{log.user_id}</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Mensagem</p>
                              <p className="p-3 bg-muted rounded-lg">{log.message}</p>
                            </div>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Payload</p>
                                <ScrollArea className="h-[200px]">
                                  <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto">
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
    </div>
  );
}
