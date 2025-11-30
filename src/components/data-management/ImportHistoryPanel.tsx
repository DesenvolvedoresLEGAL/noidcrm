import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Clock,
  FileUp,
  RotateCcw,
  Link as LinkIcon,
  Download
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type ImportLog = Database['public']['Tables']['import_logs']['Row'];

interface ImportHistoryPanelProps {
  limit?: number;
}

const ENTITY_LABELS: Record<string, string> = {
  accounts: 'Empresas',
  contacts: 'Contatos',
  opportunities: 'Oportunidades',
  products: 'Produtos',
  activities: 'Atividades',
  proposals: 'Propostas',
  loss_reasons: 'Motivos de Perda',
  origins: 'Origens',
  territories: 'Territórios',
};

const STATUS_CONFIG = {
  completed: { label: 'Concluída', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  pending: { label: 'Pendente', color: 'bg-warning/10 text-warning', icon: Clock },
  partial: { label: 'Parcial', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
};

export default function ImportHistoryPanel({ limit = 20 }: ImportHistoryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data: importLogs = [], isLoading } = useQuery({
    queryKey: ['import-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as ImportLog[];
    },
  });

  const handleToggleExpand = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const handleDownloadErrors = (log: ImportLog) => {
    if (!log.error_details) return;

    const errors = log.error_details as any;
    const csvContent = [
      'Linha,Campo,Mensagem',
      ...errors.map((err: any) => `${err.row || 'N/A'},"${err.field || 'N/A'}","${err.message || 'N/A'}"`),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `erros-importacao-${log.entity_type}-${log.id.substring(0, 8)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download iniciado",
      description: "Arquivo de erros baixado com sucesso.",
    });
  };

  const getStatusInfo = (log: ImportLog) => {
    if (log.status === 'completed' && log.error_count === 0) return STATUS_CONFIG.completed;
    if (log.status === 'completed' && log.error_count && log.error_count > 0) return STATUS_CONFIG.partial;
    if (log.status === 'failed') return STATUS_CONFIG.failed;
    return STATUS_CONFIG.pending;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Importações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">Histórico de Importações</CardTitle>
            <CardDescription className="mt-2">
              Visualize todas as importações realizadas e detalhes de erros
            </CardDescription>
          </div>
          <FileUp className="h-6 w-6 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {importLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma importação realizada ainda</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {importLogs.map((log) => {
                const statusInfo = getStatusInfo(log);
                const StatusIcon = statusInfo.icon;
                const isExpanded = expandedLog === log.id;
                const hasErrors = log.error_count && log.error_count > 0;
                const hasRelationships = log.relationship_count && log.relationship_count > 0;

                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => handleToggleExpand(log.id)}>
                    <div className="border rounded-lg p-4 hover:bg-accent/5 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <StatusIcon className={`h-5 w-5 mt-0.5 ${statusInfo.color.split(' ')[1]}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-sm">
                                {ENTITY_LABELS[log.entity_type] || log.entity_type}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {log.file_name}
                              </Badge>
                              <Badge className={`text-xs ${statusInfo.color}`}>
                                {statusInfo.label}
                              </Badge>
                              {log.operation_mode && (
                                <Badge variant="secondary" className="text-xs">
                                  {log.operation_mode === 'upsert' ? 'Upsert' : 'Insert'}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Stats */}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-success" />
                                {log.success_count || 0} sucesso
                              </span>
                              {log.update_count && log.update_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <RotateCcw className="h-3 w-3 text-primary" />
                                  {log.update_count} atualizados
                                </span>
                              )}
                              {hasRelationships && (
                                <span className="flex items-center gap-1">
                                  <LinkIcon className="h-3 w-3 text-primary" />
                                  {log.relationship_count} vínculos
                                </span>
                              )}
                              {hasErrors && (
                                <span className="flex items-center gap-1">
                                  <XCircle className="h-3 w-3 text-destructive" />
                                  {log.error_count} erros
                                </span>
                              )}
                              {log.warning_count && log.warning_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-warning" />
                                  {log.warning_count} avisos
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(log.created_at!), { 
                                addSuffix: true,
                                locale: ptBR 
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {hasErrors && log.error_details && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadErrors(log);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Erros
                            </Button>
                          )}
                          <CollapsibleTrigger asChild>
                            <Button size="sm" variant="ghost">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <CollapsibleContent className="mt-4 pt-4 border-t">
                        <div className="space-y-3">
                          {/* Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="text-sm">
                              <div className="text-muted-foreground">Total</div>
                              <div className="font-medium">{log.total_rows}</div>
                            </div>
                            <div className="text-sm">
                              <div className="text-muted-foreground">Sucesso</div>
                              <div className="font-medium text-success">{log.success_count || 0}</div>
                            </div>
                            {log.update_count && log.update_count > 0 && (
                              <div className="text-sm">
                                <div className="text-muted-foreground">Atualizados</div>
                                <div className="font-medium text-primary">{log.update_count}</div>
                              </div>
                            )}
                            <div className="text-sm">
                              <div className="text-muted-foreground">Erros</div>
                              <div className="font-medium text-destructive">{log.error_count || 0}</div>
                            </div>
                          </div>

                          {/* Error Details */}
                          {hasErrors && log.error_details && (
                            <div className="bg-destructive/5 rounded-lg p-3">
                              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-destructive" />
                                Detalhes dos Erros
                              </h5>
                              <ScrollArea className="h-[150px]">
                                <div className="space-y-2">
                                  {(log.error_details as any[])?.slice(0, 10).map((error, idx) => (
                                    <div key={idx} className="text-xs bg-background rounded p-2">
                                      <div className="font-medium">
                                        Linha {error.row || 'N/A'}
                                        {error.field && ` - Campo: ${error.field}`}
                                      </div>
                                      <div className="text-muted-foreground mt-1">
                                        {error.message || 'Erro desconhecido'}
                                      </div>
                                    </div>
                                  ))}
                                  {(log.error_details as any[])?.length > 10 && (
                                    <p className="text-xs text-muted-foreground text-center pt-2">
                                      + {(log.error_details as any[]).length - 10} erros adicionais
                                    </p>
                                  )}
                                </div>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Iniciado: {new Date(log.created_at!).toLocaleString('pt-BR')}</div>
                            {log.completed_at && (
                              <div>Concluído: {new Date(log.completed_at).toLocaleString('pt-BR')}</div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
