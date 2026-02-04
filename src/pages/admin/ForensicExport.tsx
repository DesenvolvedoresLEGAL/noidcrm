import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileSpreadsheet, 
  Loader2, 
  Download, 
  Calendar, 
  Scale, 
  Search,
  User,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserOption {
  id: string;
  email: string;
  full_name: string | null;
  organization_name: string | null;
}

export default function ForensicExport() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return format(d, "yyyy-MM-dd");
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date();
    d.setDate(0);
    return format(d, "yyyy-MM-dd");
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    filename: string;
    counts: Record<string, number>;
    hash: string;
    user_email: string;
  } | null>(null);

  // Load all users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            user_id,
            email,
            full_name,
            organization_id,
            organizations:organization_id (name)
          `)
          .order('email');

        if (error) throw error;

        setUsers(data?.map(p => ({
          id: p.user_id,
          email: p.email || '',
          full_name: p.full_name,
          organization_name: (p.organizations as any)?.name || null
        })) || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Erro ao carregar usuários');
      } finally {
        setLoadingUsers(false);
      }
    }

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.organization_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleExport = async () => {
    if (!selectedUserId || !dateStart || !dateEnd) {
      toast.error("Selecione um usuário e as datas");
      return;
    }

    setIsExporting(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('export-forensic-user-logs', {
        body: {
          user_email: selectedUser?.email,
          date_start: dateStart,
          date_end: dateEnd
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao gerar relatório');
      }

      // Convert base64 to blob and download
      const binaryString = atob(data.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastResult({
        filename: data.filename,
        counts: data.metadata.counts,
        hash: data.metadata.integrity_hash_sha256,
        user_email: selectedUser?.email || ''
      });

      toast.success(`Relatório forense gerado: ${data.metadata.counts.total} registros`);
    } catch (error: any) {
      console.error('Forensic export error:', error);
      toast.error(error.message || 'Erro ao gerar relatório forense');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6 text-amber-500" />
          Exportação Forense
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerar relatórios detalhados de atividade de usuários para fins judiciais
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros do Relatório</CardTitle>
            <CardDescription>
              Selecione o usuário e o período para exportação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Search */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Usuário
              </Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email, nome ou organização..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {loadingUsers ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Nenhum usuário encontrado
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.email}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.full_name || 'Sem nome'} 
                              {user.organization_name && ` • ${user.organization_name}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected User Info */}
            {selectedUser && (
              <div className="bg-muted/50 rounded-lg p-3 border">
                <p className="text-sm font-medium">{selectedUser.full_name || 'Sem nome'}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                {selectedUser.organization_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Org: {selectedUser.organization_name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">ID: {selectedUser.id}</p>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateStart" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data Início
                </Label>
                <Input
                  id="dateStart"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateEnd" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data Fim
                </Label>
                <Input
                  id="dateEnd"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Export Button */}
            <Button 
              onClick={handleExport} 
              disabled={isExporting || !selectedUserId}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando Relatório...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel Forense
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info & Results */}
        <div className="space-y-4">
          {/* Last result */}
          {lastResult && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-600">
                  <FileSpreadsheet className="h-5 w-5" />
                  Relatório Gerado com Sucesso!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {lastResult.user_email}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">Audit: {lastResult.counts.audit_log}</Badge>
                  <Badge variant="secondary">Auth: {lastResult.counts.auth_audit_log}</Badge>
                  <Badge variant="secondary">Events: {lastResult.counts.system_events}</Badge>
                  <Badge variant="secondary">Activities: {lastResult.counts.activities}</Badge>
                  <Badge variant="secondary">Opportunities: {lastResult.counts.opportunities}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  SHA256: {lastResult.hash}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Legal disclaimer */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Aviso Legal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Este relatório é destinado exclusivamente para fins judiciais e de compliance. 
                Os dados são extraídos diretamente do sistema com as seguintes garantias:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Hash SHA-256 para validação de integridade</li>
                <li>• Timestamp UTC de geração</li>
                <li>• Identificação do Platform Admin gerador</li>
                <li>• Dados brutos sem modificação</li>
              </ul>
            </CardContent>
          </Card>

          {/* Data sources */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dados Incluídos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <strong>AUDIT_LOG:</strong> Todas as ações no sistema CRM
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <strong>AUTH_LOG:</strong> Logins, logouts, tentativas falhas, IP, geolocalização
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <strong>SYSTEM_EVENTS:</strong> Eventos do sistema e automações
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <strong>ACTIVITIES:</strong> Atividades registradas (calls, meetings, emails)
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-pink-500" />
                  <strong>OPPORTUNITIES:</strong> Oportunidades criadas/gerenciadas
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
