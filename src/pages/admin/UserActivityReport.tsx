import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Loader2, Activity, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
// xlsx carregada dinamicamente dentro de exportToExcel()

interface ActivityRow {
  usuario: string;
  email: string;
  data: string;
  total_acoes: number;
  tipos_acao_distintos: number;
  acoes_realizadas: string;
}

export default function UserActivityReport() {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [days, setDays] = useState<number>(30);

  // Fetch organizations
  const { data: organizations } = useQuery({
    queryKey: ["admin-organizations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch activity data
  const { data: activityData, isLoading, error: queryError } = useQuery({
    queryKey: ["user-activity-report", selectedOrg, days],
    queryFn: async (): Promise<ActivityRow[]> => {
      if (!selectedOrg) return [];

      // First, get all audit_log entries for this organization
      const { data: auditData, error: auditError } = await supabase
        .from("audit_log")
        .select("created_at, action, actor_user_id")
        .eq("organization_id", selectedOrg)
        .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .not("actor_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000);

      // Debug logging for RLS issues
      console.log('[UserActivityReport] Query for org:', selectedOrg, 'days:', days);
      console.log('[UserActivityReport] auditData count:', auditData?.length);
      
      if (auditError) {
        console.error('[UserActivityReport] Query error:', auditError);
        throw auditError;
      }
      if (!auditData || auditData.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(auditData.map(row => row.actor_user_id).filter(Boolean))];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profileMap = new Map<string, { full_name: string; email: string }>();
      for (const profile of profilesData || []) {
        profileMap.set(profile.user_id, {
          full_name: profile.full_name || "Sem nome",
          email: profile.email || "",
        });
      }

      // Group by user and date
      const grouped = new Map<string, ActivityRow>();
      
      for (const row of auditData) {
        const profile = profileMap.get(row.actor_user_id!);
        if (!profile || !profile.email) continue;
        
        const date = new Date(row.created_at).toISOString().split("T")[0];
        const key = `${profile.email}-${date}`;
        
        const existing = grouped.get(key);
        if (existing) {
          existing.total_acoes++;
          if (!existing.acoes_realizadas.includes(row.action)) {
            existing.acoes_realizadas += `, ${row.action}`;
            existing.tipos_acao_distintos++;
          }
        } else {
          grouped.set(key, {
            usuario: profile.full_name,
            email: profile.email,
            data: date,
            total_acoes: 1,
            tipos_acao_distintos: 1,
            acoes_realizadas: row.action,
          });
        }
      }

      return Array.from(grouped.values()).sort((a, b) => {
        const nameCompare = a.usuario.localeCompare(b.usuario);
        if (nameCompare !== 0) return nameCompare;
        return b.data.localeCompare(a.data);
      });
    },
    enabled: !!selectedOrg,
  });

  const exportToExcel = async () => {
    if (!activityData || activityData.length === 0) return;
    const XLSX = await import("xlsx");

    const orgName = organizations?.find(o => o.id === selectedOrg)?.name || "Organização";
    
    // Prepare data for Excel
    const excelData = activityData.map(row => ({
      "Usuário": row.usuario,
      "Email": row.email,
      "Data": format(new Date(row.data), "dd/MM/yyyy", { locale: ptBR }),
      "Total de Ações": row.total_acoes,
      "Tipos de Ação": row.tipos_acao_distintos,
      "Ações Realizadas": row.acoes_realizadas,
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atividades");

    // Set column widths
    ws["!cols"] = [
      { wch: 25 }, // Usuário
      { wch: 35 }, // Email
      { wch: 12 }, // Data
      { wch: 15 }, // Total de Ações
      { wch: 15 }, // Tipos de Ação
      { wch: 60 }, // Ações Realizadas
    ];

    // Generate filename
    const filename = `atividades_${orgName.replace(/\s+/g, "_")}_${days}dias_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };

  // Calculate summary stats
  const totalActions = activityData?.reduce((sum, row) => sum + row.total_acoes, 0) || 0;
  const uniqueUsers = new Set(activityData?.map(row => row.email)).size;
  const uniqueDays = new Set(activityData?.map(row => row.data)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Atividade</h1>
          <p className="text-muted-foreground">
            Atividades diárias por usuário baseado no audit_log
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Selecione a organização e o período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organização</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione uma organização" />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={exportToExcel}
              disabled={!activityData || activityData.length === 0}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {activityData && activityData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalActions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total de Ações</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueUsers}</p>
                <p className="text-xs text-muted-foreground">Usuários Ativos</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueDays}</p>
                <p className="text-xs text-muted-foreground">Dias com Atividade</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {activityData?.length || 0} registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedOrg ? (
            <div className="text-center py-12 text-muted-foreground">
              Selecione uma organização para ver os dados
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : queryError ? (
            <div className="text-center py-12">
              <p className="text-destructive font-medium">Erro ao carregar dados</p>
              <p className="text-xs text-muted-foreground mt-2">
                {queryError instanceof Error ? queryError.message : 'Erro desconhecido'}
              </p>
            </div>
          ) : activityData?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma atividade encontrada no período</p>
              <p className="text-xs text-muted-foreground mt-2">
                Verifique se você tem permissão para visualizar dados desta organização.
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    <TableHead>Tipos de Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityData?.map((row, idx) => (
                    <TableRow key={`${row.email}-${row.data}-${idx}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.usuario}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(row.data), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-mono">
                          {row.total_acoes}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {row.acoes_realizadas.split(", ").slice(0, 4).map((action, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                          {row.acoes_realizadas.split(", ").length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{row.acoes_realizadas.split(", ").length - 4}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
