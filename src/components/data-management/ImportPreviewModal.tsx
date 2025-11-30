import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Plus, RefreshCw, Link } from "lucide-react";
import type { EntityType, ColumnMapping, ValidationResult, OperationMode, ImportProgress } from "@/services/crm/data-import";

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
  onConfirmImport: (mapping: ColumnMapping, operationMode: OperationMode, autoRelationships: boolean, autoCreateMissing: boolean) => void;
  isValidating: boolean;
  isImporting: boolean;
  importProgress?: ImportProgress | null;
}

const FIELD_OPTIONS: Record<EntityType, Array<{ value: string; label: string }>> = {
  accounts: [
    { value: 'razao_social', label: 'Razão Social *' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'nome_fantasia', label: 'Nome Fantasia' },
    { value: 'segmento', label: 'Segmento' },
    { value: 'tamanho', label: 'Tamanho' },
    { value: 'cnae', label: 'CNAE Principal' },
    { value: 'cnaes_secundarios', label: 'CNAEs Secundários' },
    { value: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { value: 'inscricao_municipal', label: 'Inscrição Municipal' },
    { value: 'capital_social', label: 'Capital Social' },
    { value: 'data_fundacao', label: 'Data de Fundação' },
    { value: 'natureza_juridica', label: 'Natureza Jurídica' },
    { value: 'porte', label: 'Porte' },
    { value: 'logradouro', label: 'Logradouro' },
    { value: 'numero', label: 'Número' },
    { value: 'complemento', label: 'Complemento' },
    { value: 'bairro', label: 'Bairro' },
    { value: 'cidade', label: 'Cidade' },
    { value: 'uf', label: 'UF' },
    { value: 'cep', label: 'CEP' },
    { value: 'emails', label: 'E-mails' },
    { value: 'telefones', label: 'Telefones' },
    { value: 'website', label: 'Website' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'data_tornou_cliente', label: 'Data Tornou Cliente' },
    { value: 'origem_principal', label: 'Origem Principal' },
    { value: 'observacoes', label: 'Observações' },
    { value: 'codigo_externo', label: 'Código Externo' },
    { value: 'tipo_empresa', label: 'Tipo de Empresa' },
    { value: 'owner_email', label: 'E-mail do Responsável' },
    { value: 'nome_responsavel_legal', label: 'Nome Responsável Legal' },
    { value: 'email_responsavel_legal', label: 'E-mail Responsável Legal' },
    { value: 'whatsapp_responsavel_legal', label: 'WhatsApp Responsável Legal' },
    { value: 'nome_responsavel_financeiro', label: 'Nome Responsável Financeiro' },
    { value: 'email_responsavel_financeiro', label: 'E-mail Responsável Financeiro' },
    { value: 'whatsapp_responsavel_financeiro', label: 'WhatsApp Responsável Financeiro' },
    { value: 'regioes', label: 'Regiões' },
    { value: 'tags', label: 'Tags' },
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
  products: [
    { value: 'name', label: 'Nome *' },
    { value: 'reference', label: 'Código/SKU' },
    { value: 'type', label: 'Tipo (produto/serviço)' },
    { value: 'price', label: 'Preço' },
    { value: 'cost', label: 'Custo' },
    { value: 'unit', label: 'Unidade' },
    { value: 'description', label: 'Descrição' },
    { value: 'category_name', label: 'Nome da Categoria' },
    { value: 'ipi_percent', label: 'IPI (%)' },
  ],
  activities: [
    { value: 'title', label: 'Título *' },
    { value: 'type', label: 'Tipo (call/meeting/email/task)' },
    { value: 'description', label: 'Descrição' },
    { value: 'scheduled_date', label: 'Data (YYYY-MM-DD)' },
    { value: 'scheduled_time', label: 'Hora (HH:mm)' },
    { value: 'duration_minutes', label: 'Duração (minutos)' },
    { value: 'status', label: 'Status' },
    { value: 'account_cnpj', label: 'CNPJ da Empresa' },
    { value: 'contact_email', label: 'E-mail do Contato' },
    { value: 'opportunity_title', label: 'Título da Oportunidade' },
  ],
  proposals: [
    { value: 'title', label: 'Título *' },
    { value: 'value', label: 'Valor' },
    { value: 'client_name', label: 'Nome do Cliente' },
    { value: 'client_email', label: 'E-mail do Cliente' },
    { value: 'status', label: 'Status' },
    { value: 'opportunity_title', label: 'Título da Oportunidade' },
    { value: 'expires_at', label: 'Validade (YYYY-MM-DD)' },
    { value: 'introduction', label: 'Introdução' },
    { value: 'terms', label: 'Termos e Condições' },
  ],
  loss_reasons: [
    { value: 'name', label: 'Nome *' },
    { value: 'is_active', label: 'Ativo (true/false)' },
  ],
  origins: [
    { value: 'name', label: 'Nome *' },
    { value: 'group_name', label: 'Nome do Grupo' },
    { value: 'is_active', label: 'Ativo (true/false)' },
  ],
  territories: [
    { value: 'name', label: 'Nome *' },
    { value: 'type', label: 'Tipo (geographic/segment)' },
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
  isImporting,
  importProgress,
}: ImportPreviewModalProps) {
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(initialMapping);
  const [operationMode, setOperationMode] = useState<OperationMode>('insert');
  const [autoRelationships, setAutoRelationships] = useState(true);
  const [autoCreateMissing, setAutoCreateMissing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const progressPercentage = importProgress 
    ? Math.round((importProgress.current / importProgress.total) * 100)
    : 0;

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
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] p-0 gap-0 flex flex-col">
        {/* FIXED HEADER */}
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="p-4 md:p-6 pb-3 space-y-1.5">
            <DialogTitle className="text-base md:text-lg">Preview de Importação</DialogTitle>
            <DialogDescription className="text-xs md:text-sm space-y-0.5">
              <div>{fileName}</div>
              <div className="text-muted-foreground">{totalRows.toLocaleString('pt-BR')} registros</div>
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 md:p-6 space-y-4">
            {/* Operation Mode */}
            <div className="space-y-2 p-3 md:p-4 border rounded-lg bg-accent/5">
              <Label className="text-sm font-medium">Modo de Operação</Label>
              <Select value={operationMode} onValueChange={(value: OperationMode) => setOperationMode(value)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="insert">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Insert Only</div>
                        <div className="text-xs text-muted-foreground">Apenas novos registros</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="upsert">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Upsert</div>
                        <div className="text-xs text-muted-foreground">Atualiza ou insere</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto Relationships */}
            {(['contacts', 'opportunities', 'activities', 'proposals', 'products'].includes(entityType)) && (
              <div className="border rounded-lg p-3 md:p-4 space-y-3 bg-accent/5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Relacionamentos Automáticos</Label>
                  <Switch checked={autoRelationships} onCheckedChange={setAutoRelationships} />
                </div>
                
                {autoRelationships && (
                  <div className="space-y-3 pl-1">
                    <div className="text-sm text-muted-foreground space-y-2">
                      {entityType === 'contacts' && (
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-primary" />
                          <span>Vincular a empresas via CNPJ</span>
                        </div>
                      )}
                      {entityType === 'opportunities' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-primary" />
                            <span>Vincular a contas via CNPJ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-primary" />
                            <span>Vincular a contatos via Email</span>
                          </div>
                        </>
                      )}
                      {entityType === 'activities' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-primary" />
                            <span>Vincular a empresas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-primary" />
                            <span>Vincular a contatos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link className="h-4 w-4 text-primary" />
                            <span>Vincular a oportunidades</span>
                          </div>
                        </>
                      )}
                      {entityType === 'proposals' && (
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-primary" />
                          <span>Vincular a oportunidades</span>
                        </div>
                      )}
                      {entityType === 'products' && (
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-primary" />
                          <span>Vincular a categorias</span>
                        </div>
                      )}
                    </div>
                    
                    {(['activities', 'products', 'contacts'].includes(entityType)) && (
                      <div className="flex items-start gap-3 pt-2 border-t">
                        <input
                          type="checkbox"
                          id="autoCreateMissing"
                          checked={autoCreateMissing}
                          onChange={(e) => setAutoCreateMissing(e.target.checked)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label htmlFor="autoCreateMissing" className="text-sm font-medium cursor-pointer">
                            Criar em cascata
                          </label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {entityType === 'activities' && 'Criar empresas se não existirem'}
                            {entityType === 'products' && 'Criar categorias se não existirem'}
                            {entityType === 'contacts' && 'Criar empresas se não existirem'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Column Mapping */}
            <div>
              <h3 className="text-sm font-medium mb-2">Mapeamento de Colunas</h3>
              <p className="text-xs text-muted-foreground mb-3">Selecione o campo correspondente</p>
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-3 pr-4">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-medium min-w-[150px] truncate">
                        {header}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <Select
                        value={columnMapping[header] || '_ignore'}
                        onValueChange={(value) => handleMappingChange(header, value === '_ignore' ? '' : value)}
                      >
                        <SelectTrigger className="w-[220px] h-9">
                          <SelectValue placeholder="Campo..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] z-[60]">
                          <SelectItem value="_ignore">Ignorar coluna</SelectItem>
                          {FIELD_OPTIONS[entityType]?.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Validation Summary */}
            {validationResult && (
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium">Válidos</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {validCount.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium">Avisos</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {warningCount.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-red-50 dark:bg-red-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium">Erros</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {errorCount.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            )}

            {/* Data Preview */}
            <div>
              <h3 className="text-sm font-medium mb-2">Preview dos Dados</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Mostrando {Math.min(5, previewData.length)} de {totalRows.toLocaleString('pt-BR')} registros
              </p>
              <ScrollArea className="h-[250px] border rounded-lg">
                <div className="p-4 space-y-3">
                  {previewData.slice(0, 5).map((row, index) => {
                    const status = getRowStatus(index);
                    const message = getRowMessage(index);
                    
                    return (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                            {status === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                            {status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                            {status === 'error' && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row).slice(0, isMobile ? 3 : 6).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}: {String(value).substring(0, 20)}
                              </Badge>
                            ))}
                            {Object.entries(row).length > (isMobile ? 3 : 6) && (
                              <Badge variant="outline" className="text-xs">
                                +{Object.entries(row).length - (isMobile ? 3 : 6)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {message && (
                          <p className="text-xs text-muted-foreground">{message}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* FIXED FOOTER */}
        <div className="flex-shrink-0 border-t bg-background">
          <DialogFooter className="p-4 md:p-6 pt-3">
            {isImporting && importProgress ? (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Lote {importProgress.currentBatch}/{importProgress.totalBatches}
                  </span>
                  <span className="font-medium">
                    {importProgress.current.toLocaleString('pt-BR')}/{importProgress.total.toLocaleString('pt-BR')} ({progressPercentage}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>✓ Sucesso: {importProgress.successCount.toLocaleString('pt-BR')}</span>
                  {importProgress.errorCount > 0 && (
                    <span className="text-destructive">✗ Erros: {importProgress.errorCount.toLocaleString('pt-BR')}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-2 w-full justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)} 
                  disabled={isValidating || isImporting}
                  className="min-w-[100px]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => onConfirmImport(columnMapping, operationMode, autoRelationships, autoCreateMissing)}
                  disabled={isValidating || isImporting}
                  className="min-w-[140px]"
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
              </div>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
