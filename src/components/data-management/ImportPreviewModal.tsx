import { useState } from "react";
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

  // Detect mobile/tablet
  useState(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

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
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] flex flex-col p-0">
        {/* HEADER - Fixed */}
        <DialogHeader className="flex-shrink-0 space-y-2 p-4 md:p-6 pb-3 border-b">
          <DialogTitle className="text-lg md:text-xl">Preview de Importação</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            <span className="block md:inline">{fileName}</span>
            <span className="hidden md:inline"> • </span>
            <span className="block md:inline">{totalRows.toLocaleString('pt-BR')} registros</span>
          </DialogDescription>
        </DialogHeader>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          <div className="space-y-4 md:space-y-6">
            {/* Operation Mode Selector */}
            <div className="space-y-2 md:space-y-3 p-3 md:p-4 border rounded-lg bg-accent/5">
              <Label className="text-xs md:text-sm font-medium">Modo de Operação</Label>
              <Select value={operationMode} onValueChange={(value: OperationMode) => setOperationMode(value)}>
                <SelectTrigger className="h-10 md:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="insert">
                    <div className="flex items-center gap-2 py-1">
                      <Plus className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-xs md:text-sm">Insert Only</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground truncate">
                          Apenas novos registros
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="upsert">
                    <div className="flex items-center gap-2 py-1">
                      <RefreshCw className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-xs md:text-sm">Upsert</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground truncate">
                          Atualiza ou insere
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto Relationships */}
            {(['contacts', 'opportunities', 'activities', 'proposals', 'products'].includes(entityType)) && (
              <div className="border rounded-lg p-3 md:p-4 space-y-2 md:space-y-3 bg-accent/5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs md:text-sm font-medium">Relacionamentos Automáticos</Label>
                  <Switch checked={autoRelationships} onCheckedChange={setAutoRelationships} />
                </div>
                
                {autoRelationships && (
                  <div className="space-y-2 md:space-y-3 pl-0 md:pl-1">
                    <div className="text-xs md:text-sm text-muted-foreground space-y-1.5 md:space-y-2">
                      {entityType === 'contacts' && (
                        <div className="flex items-center gap-2">
                          <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                          <span className="text-[11px] md:text-sm">Vincular a empresas via CNPJ</span>
                        </div>
                      )}
                      {entityType === 'opportunities' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                            <span className="text-[11px] md:text-sm">Vincular a contas via CNPJ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                            <span className="text-[11px] md:text-sm">Vincular a contatos via Email</span>
                          </div>
                        </>
                      )}
                      {entityType === 'activities' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                            <span className="text-[11px] md:text-sm">Vincular a empresas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                            <span className="text-[11px] md:text-sm">Vincular a contatos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                            <span className="text-[11px] md:text-sm">Vincular a oportunidades</span>
                          </div>
                        </>
                      )}
                      {entityType === 'proposals' && (
                        <div className="flex items-center gap-2">
                          <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                          <span className="text-[11px] md:text-sm">Vincular a oportunidades</span>
                        </div>
                      )}
                      {entityType === 'products' && (
                        <div className="flex items-center gap-2">
                          <Link className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
                          <span className="text-[11px] md:text-sm">Vincular a categorias</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Auto-create missing entities */}
                    {(['activities', 'products', 'contacts'].includes(entityType)) && (
                      <div className="flex items-start gap-2 md:gap-3 pt-2 border-t">
                        <input
                          type="checkbox"
                          id="autoCreateMissing"
                          checked={autoCreateMissing}
                          onChange={(e) => setAutoCreateMissing(e.target.checked)}
                          className="mt-0.5 md:mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <label htmlFor="autoCreateMissing" className="text-xs md:text-sm font-medium cursor-pointer text-foreground block">
                            Criar em cascata
                          </label>
                          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
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
              <h3 className="text-xs md:text-sm font-medium mb-1.5 md:mb-2">Mapeamento de Colunas</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3">
                Selecione o campo correspondente
              </p>
              <ScrollArea className="h-[250px] md:h-[300px] border rounded-lg p-2 md:p-4">
                <div className="space-y-2 md:space-y-3 pr-2 md:pr-4">
                  {headers.map((header) => (
                    <div key={header} className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 p-2 md:p-0 bg-accent/5 md:bg-transparent rounded md:rounded-none">
                      <span className="text-[11px] md:text-sm text-muted-foreground font-medium md:min-w-[150px] truncate">
                        {header}
                      </span>
                      <span className="text-muted-foreground hidden md:inline">→</span>
                      <Select
                        value={columnMapping[header] || '_ignore'}
                        onValueChange={(value) => handleMappingChange(header, value === '_ignore' ? '' : value)}
                      >
                        <SelectTrigger className="w-full md:w-[200px] h-9 text-xs md:text-sm">
                          <SelectValue placeholder="Campo..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px] md:max-h-[300px] z-[60]">
                          <SelectItem value="_ignore" className="text-xs md:text-sm">
                            Ignorar coluna
                          </SelectItem>
                          {FIELD_OPTIONS[entityType].map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs md:text-sm">
                              {option.label}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                <div className="flex items-center gap-2 p-2.5 md:p-3 bg-success/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-success shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium">{validCount.toLocaleString('pt-BR')} válidos</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">Serão importados</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 md:p-3 bg-warning/10 rounded-lg">
                  <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-warning shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium">{warningCount.toLocaleString('pt-BR')} avisos</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">Atenção</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 md:p-3 bg-destructive/10 rounded-lg">
                  <XCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium">{errorCount.toLocaleString('pt-BR')} erros</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">Não serão importados</div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Preview */}
            <div>
              <h3 className="text-xs md:text-sm font-medium mb-1.5 md:mb-2">Preview dos Dados</h3>
              <ScrollArea className="h-[180px] md:h-[200px] border rounded-lg">
                <div className="p-2 md:p-4 space-y-1.5 md:space-y-2">
                  {previewData.map((row, index) => {
                    const status = getRowStatus(index);
                    const message = getRowMessage(index);

                    return (
                      <div
                        key={index}
                        className={`p-2 md:p-3 rounded-lg border ${
                          status === 'error' ? 'border-destructive bg-destructive/5' :
                          status === 'warning' ? 'border-warning bg-warning/5' :
                          'border-border bg-background'
                        }`}
                      >
                        <div className="flex items-start gap-1.5 md:gap-2">
                          {status === 'valid' && <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-success mt-0.5 shrink-0" />}
                          {status === 'warning' && <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-warning mt-0.5 shrink-0" />}
                          {status === 'error' && <XCircle className="h-3 w-3 md:h-4 md:w-4 text-destructive mt-0.5 shrink-0" />}
                          {status === 'unknown' && <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin mt-0.5 shrink-0" />}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                              {Object.entries(row).slice(0, isMobile ? 3 : 10).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-[10px] md:text-xs">
                                  {key}: {String(value).substring(0, isMobile ? 15 : 30)}
                                  {String(value).length > (isMobile ? 15 : 30) ? '...' : ''}
                                </Badge>
                              ))}
                              {Object.entries(row).length > (isMobile ? 3 : 10) && (
                                <Badge variant="outline" className="text-[10px] md:text-xs">
                                  +{Object.entries(row).length - (isMobile ? 3 : 10)} campos
                                </Badge>
                              )}
                            </div>
                            {message && (
                              <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-2">{message}</p>
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
        </div>

        {/* FOOTER - Fixed */}
        <DialogFooter className="flex-shrink-0 border-t p-4 md:p-6 pt-3 md:pt-4 bg-background gap-2">
          {isImporting && importProgress && (
            <div className="w-full space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-xs md:text-sm">
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
              <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  ✓ {importProgress.successCount.toLocaleString('pt-BR')}
                </span>
                {importProgress.errorCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    ✗ {importProgress.errorCount.toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {!isImporting && (
            <div className="flex flex-col-reverse md:flex-row gap-2 w-full md:w-auto md:ml-auto">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                disabled={isValidating}
                className="w-full md:w-auto text-xs md:text-sm h-9 md:h-10"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  console.log('Importar clicked', { columnMapping, operationMode, autoRelationships, autoCreateMissing });
                  onConfirmImport(columnMapping, operationMode, autoRelationships, autoCreateMissing);
                }}
                disabled={isValidating || isImporting}
                className="w-full md:w-auto md:min-w-[140px] text-xs md:text-sm h-9 md:h-10"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  'Importar'
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
