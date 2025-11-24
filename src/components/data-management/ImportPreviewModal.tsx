import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import type { EntityType, ColumnMapping, ValidationResult } from "@/services/crm/data-import";

interface ImportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  entityType: EntityType;
  headers: string[];
  previewData: any[];
  totalRows: number;
  initialMapping: ColumnMapping;
  validationResult: ValidationResult | null;
  onConfirmImport: (mapping: ColumnMapping) => void;
  isValidating: boolean;
}

const FIELD_OPTIONS: Record<EntityType, Array<{ value: string; label: string }>> = {
  accounts: [
    { value: 'razao_social', label: 'Razão Social *' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'nome_fantasia', label: 'Nome Fantasia' },
    { value: 'segmento', label: 'Segmento' },
    { value: 'tamanho', label: 'Tamanho' },
    { value: 'cnae', label: 'CNAE' },
    { value: 'origem_principal', label: 'Origem Principal' },
  ],
  contacts: [
    { value: 'nome', label: 'Nome *' },
    { value: 'emails', label: 'E-mails' },
    { value: 'telefones', label: 'Telefones' },
    { value: 'cargo', label: 'Cargo' },
    { value: 'account_id', label: 'ID da Empresa' },
  ],
  opportunities: [
    { value: 'title', label: 'Título *' },
    { value: 'valor_previsto', label: 'Valor Previsto' },
    { value: 'prob', label: 'Probabilidade (%)' },
    { value: 'account_id', label: 'ID da Empresa' },
    { value: 'contact_id', label: 'ID do Contato' },
    { value: 'produto', label: 'Produto' },
    { value: 'temperature', label: 'Temperatura' },
    { value: 'close_date_prevista', label: 'Data Prevista de Fechamento' },
  ],
};

export default function ImportPreviewModal({
  open,
  onOpenChange,
  fileName,
  entityType,
  headers,
  previewData,
  totalRows,
  initialMapping,
  validationResult,
  onConfirmImport,
  isValidating,
}: ImportPreviewModalProps) {
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(initialMapping);

  const handleMappingChange = (fileColumn: string, crmField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [fileColumn]: crmField,
    }));
  };

  const getRowStatus = (rowIndex: number) => {
    if (!validationResult) return 'unknown';
    
    const hasError = validationResult.errors.some(e => e.row === rowIndex);
    if (hasError) return 'error';
    
    const hasWarning = validationResult.warnings.some(w => w.row === rowIndex);
    const hasDuplicate = validationResult.duplicates.some(d => d.row === rowIndex);
    if (hasWarning || hasDuplicate) return 'warning';
    
    return 'valid';
  };

  const getRowMessage = (rowIndex: number) => {
    if (!validationResult) return null;
    
    const error = validationResult.errors.find(e => e.row === rowIndex);
    if (error) return error.message;
    
    const warning = validationResult.warnings.find(w => w.row === rowIndex);
    if (warning) return warning.message;
    
    const duplicate = validationResult.duplicates.find(d => d.row === rowIndex);
    if (duplicate) return `Possível duplicata: ${duplicate.field} = ${duplicate.value}`;
    
    return null;
  };

  const validCount = validationResult ? totalRows - validationResult.errors.length - validationResult.warnings.length : 0;
  const errorCount = validationResult?.errors.length || 0;
  const warningCount = (validationResult?.warnings.length || 0) + (validationResult?.duplicates.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Preview de Importação</DialogTitle>
          <DialogDescription>
            Arquivo: {fileName} • {totalRows} registros encontrados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Column Mapping */}
          <div>
            <h3 className="text-sm font-medium mb-2">Mapeamento de Colunas</h3>
            <div className="grid grid-cols-2 gap-4">
              {headers.map((header) => (
                <div key={header} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground min-w-[150px]">{header}</span>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={columnMapping[header] || '_ignore'}
                    onValueChange={(value) => handleMappingChange(header, value === '_ignore' ? '' : value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione o campo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ignore">Ignorar coluna</SelectItem>
                      {FIELD_OPTIONS[entityType].map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Summary */}
          {validationResult && (
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <div className="text-sm font-medium">{validCount} válidos</div>
                  <div className="text-xs text-muted-foreground">Serão importados</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <div className="text-sm font-medium">{warningCount} avisos</div>
                  <div className="text-xs text-muted-foreground">Requerem atenção</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <div className="text-sm font-medium">{errorCount} erros</div>
                  <div className="text-xs text-muted-foreground">Não serão importados</div>
                </div>
              </div>
            </div>
          )}

          {/* Data Preview */}
          <div>
            <h3 className="text-sm font-medium mb-2">Preview dos Dados</h3>
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-2">
                {previewData.map((row, index) => {
                  const status = getRowStatus(index);
                  const message = getRowMessage(index);

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        status === 'error' ? 'border-destructive bg-destructive/5' :
                        status === 'warning' ? 'border-warning bg-warning/5' :
                        'border-border bg-background'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {status === 'valid' && <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />}
                        {status === 'warning' && <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />}
                        {status === 'error' && <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
                        {status === 'unknown' && <Loader2 className="h-4 w-4 animate-spin mt-0.5" />}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {Object.entries(row).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value).substring(0, 30)}
                                {String(value).length > 30 ? '...' : ''}
                              </Badge>
                            ))}
                          </div>
                          {message && (
                            <p className="text-xs text-muted-foreground mt-1">{message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirmImport(columnMapping)}
            disabled={isValidating || (validationResult && !validationResult.valid && errorCount === totalRows)}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              'Importar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
