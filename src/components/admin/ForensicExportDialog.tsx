import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Download, Calendar, Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ForensicExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export function ForensicExportDialog({ open, onOpenChange, user }: ForensicExportDialogProps) {
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return format(d, "yyyy-MM-dd");
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date();
    d.setDate(0); // Last day of previous month
    return format(d, "yyyy-MM-dd");
  });
  const [isExporting, setIsExporting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    filename: string;
    counts: Record<string, number>;
    hash: string;
  } | null>(null);

  const handleExport = async () => {
    if (!dateStart || !dateEnd) {
      toast.error("Selecione as datas de início e fim");
      return;
    }

    setIsExporting(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('export-forensic-user-logs', {
        body: {
          user_email: user.email,
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
        hash: data.metadata.integrity_hash_sha256
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-500" />
            Relatório Forense Judicial
          </DialogTitle>
          <DialogDescription>
            Exportar logs detalhados do usuário para fins judiciais. Inclui audit_log, 
            autenticação, eventos do sistema, atividades e oportunidades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User info */}
          <div className="bg-muted/50 rounded-lg p-3 border">
            <p className="text-sm font-medium">{user.full_name || 'Sem nome'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {user.id}</p>
          </div>

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

          {/* Last result */}
          {lastResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Relatório gerado com sucesso!
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Audit: {lastResult.counts.audit_log}</Badge>
                <Badge variant="secondary">Auth: {lastResult.counts.auth_audit_log}</Badge>
                <Badge variant="secondary">Events: {lastResult.counts.system_events}</Badge>
                <Badge variant="secondary">Activities: {lastResult.counts.activities}</Badge>
                <Badge variant="secondary">Opportunities: {lastResult.counts.opportunities}</Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono break-all">
                SHA256: {lastResult.hash.substring(0, 32)}...
              </p>
            </div>
          )}

          {/* Legal disclaimer */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs text-amber-600">
              <strong>AVISO LEGAL:</strong> Este relatório é destinado exclusivamente para 
              fins judiciais. Os dados são extraídos diretamente do sistema e incluem 
              hash de integridade SHA-256 para validação.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
