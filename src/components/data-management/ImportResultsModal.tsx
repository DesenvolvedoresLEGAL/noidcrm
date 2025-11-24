import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Download, RefreshCw, Link } from "lucide-react";
import type { ImportResult } from "@/services/crm/data-import";
import Papa from 'papaparse';

interface ImportResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ImportResult | null;
  fileName: string;
}

export default function ImportResultsModal({
  open,
  onOpenChange,
  result,
  fileName,
}: ImportResultsModalProps) {
  if (!result) return null;

  const handleDownloadErrors = () => {
    if (!result.errors || result.errors.length === 0) return;

    const csv = Papa.unparse(result.errors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `erros_importacao_${fileName}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {result.success ? '✅ Importação Concluída' : '⚠️ Importação Concluída com Erros'}
          </DialogTitle>
          <DialogDescription>
            Arquivo: {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-success/10 rounded-lg text-center">
              <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
              <div className="text-2xl font-bold">{result.successCount}</div>
              <div className="text-sm text-muted-foreground">Inseridos</div>
            </div>

            {result.updateCount !== undefined && result.updateCount > 0 && (
              <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                <RefreshCw className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{result.updateCount}</div>
                <div className="text-sm text-muted-foreground">Atualizados</div>
              </div>
            )}

            {result.relationshipCount !== undefined && result.relationshipCount > 0 && (
              <div className="p-4 bg-purple-500/10 rounded-lg text-center">
                <Link className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{result.relationshipCount}</div>
                <div className="text-sm text-muted-foreground">Relacionamentos</div>
              </div>
            )}

            {result.errorCount > 0 && (
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <div className="text-2xl font-bold">{result.errorCount}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            )}
          </div>

          {/* Error Details */}
          {result.errors && result.errors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Registros com Problemas</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadErrors}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Erros (CSV)
                </Button>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {result.errors.map((error, index) => (
                    <div
                      key={index}
                      className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="destructive" className="mt-0.5">
                          Linha {error.row + 1}
                        </Badge>
                        <p className="text-sm flex-1">{error.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Success Message */}
          {result.success && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm text-center">
                🎉 Importação concluída: {result.successCount} inseridos
                {result.updateCount ? `, ${result.updateCount} atualizados` : ''}
                {result.relationshipCount ? `, ${result.relationshipCount} relacionamentos` : ''}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
