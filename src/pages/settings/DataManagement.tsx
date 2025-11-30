import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileJson, FileSpreadsheet, Loader2, Upload, FileUp, FileText, Calendar, Clock, FileDown, Building2, Package, Activity, FileCheck, Tag, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { exportData } from '@/services/crm/data-export';
import { 
  parseFile, 
  autoMapColumns, 
  transformData, 
  validateImportData, 
  executeImport,
  type EntityType as ImportEntityType,
  type ParsedData,
  type ColumnMapping,
  type ValidationResult,
  type ImportResult,
  type OperationMode,
} from '@/services/crm/data-import';
import ImportPreviewModal from '@/components/data-management/ImportPreviewModal';
import ImportResultsModal from '@/components/data-management/ImportResultsModal';
import ImportTemplateModal from '@/components/data-management/ImportTemplateModal';
import ExportTemplateModal from '@/components/data-management/ExportTemplateModal';
import ScheduledExportModal from '@/components/data-management/ScheduledExportModal';
import ImportHistoryPanel from '@/components/data-management/ImportHistoryPanel';
import ImportStatsCard from '@/components/data-management/ImportStatsCard';

type EntityType = 'opportunities' | 'accounts' | 'contacts' | 'products' | 'activities';
type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

const entities = [
  { id: 'opportunities' as EntityType, label: 'Oportunidades', icon: '💼', color: 'bg-blue-500/10 text-blue-600' },
  { id: 'accounts' as EntityType, label: 'Empresas', icon: '🏢', color: 'bg-green-500/10 text-green-600' },
  { id: 'contacts' as EntityType, label: 'Contatos', icon: '👤', color: 'bg-purple-500/10 text-purple-600' },
  { id: 'products' as EntityType, label: 'Produtos/Serviços', icon: '📦', color: 'bg-orange-500/10 text-orange-600' },
  { id: 'activities' as EntityType, label: 'Atividades', icon: '📅', color: 'bg-pink-500/10 text-pink-600' },
];

export default function DataManagement() {
  const { toast } = useToast();
  
  // Export state
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('opportunities');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [importEntity, setImportEntity] = useState<ImportEntityType>('accounts');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Sprint 4 state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showImportTemplateModal, setShowImportTemplateModal] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportData(selectedEntity, exportFormat);
      
      const entityLabel = entities.find(e => e.id === selectedEntity)?.label || selectedEntity;
      toast({
        title: "Exportação concluída!",
        description: `${entityLabel} exportado${exportFormat === 'csv' ? 'as' : 's'} em ${exportFormat.toUpperCase()} com sucesso.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10 MB.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      toast({
        title: "Formato não suportado",
        description: "Use arquivos CSV ou Excel (.xlsx, .xls).",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Parse file
      const parsed = await parseFile(file);
      
      if (parsed.rows.length > 5000) {
        toast({
          title: "Limite de registros excedido",
          description: "Máximo de 5.000 registros por importação.",
          variant: "destructive",
        });
        return;
      }

      // Auto-map columns
      const mapping = autoMapColumns(parsed.headers, importEntity);
      
      setUploadedFile(file);
      setParsedData(parsed);
      setColumnMapping(mapping);
      setShowPreviewModal(true);

      // Start validation in background
      setIsValidating(true);
      const transformedData = transformData(parsed.rows, mapping);
      const validation = await validateImportData(importEntity, transformedData, mapping);
      setValidationResult(validation);
      setIsValidating(false);

    } catch (error) {
      console.error('File parsing error:', error);
      toast({
        title: "Erro ao ler arquivo",
        description: error instanceof Error ? error.message : "Não foi possível processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async (
    finalMapping: ColumnMapping, 
    operationMode: OperationMode, 
    autoRelationships: boolean,
    autoCreateMissing: boolean = false
  ) => {
    if (!parsedData || !uploadedFile) return;

    setIsProcessing(true);
    try {
      let transformedData = transformData(parsedData.rows, finalMapping);
      
      // Detect relationships if enabled
      if (autoRelationships && ['contacts', 'opportunities', 'activities', 'proposals', 'products'].includes(importEntity)) {
        const { detectRelationships } = await import('@/services/crm/data-import');
        
        const relationshipResult = await detectRelationships(
          importEntity,
          transformedData,
          {
            company_cnpj_column: 'company_cnpj',
            contact_email_column: 'contact_email',
            account_name_column: 'company_name',
            opportunity_title_column: 'opportunity_title',
            category_name_column: 'category_name',
          },
          autoCreateMissing
        );
        
        transformedData = relationshipResult.updated_data;
        
        if (relationshipResult.relationships_found > 0) {
          toast({
            title: "Relacionamentos detectados",
            description: `${relationshipResult.relationships_found} relacionamentos automáticos encontrados.`,
          });
        }
      }

      const uniqueFields: Record<ImportEntityType, string> = {
        accounts: 'cnpj',
        contacts: 'emails',
        opportunities: 'title',
        products: 'reference',
        activities: 'title',
        proposals: 'title',
        loss_reasons: 'name',
        origins: 'name',
        territories: 'name',
      };

      const result = await executeImport(
        importEntity, 
        transformedData, 
        uploadedFile.name, 
        operationMode,
        {
          mode: operationMode,
          unique_field: uniqueFields[importEntity],
          update_strategy: 'merge',
        }
      );
      
      setImportResult(result);
      setShowPreviewModal(false);
      setShowResultsModal(true);

      if (result.success) {
        const summary = [
          `${result.successCount} inseridos`,
          result.updateCount ? `${result.updateCount} atualizados` : null,
        ].filter(Boolean).join(', ');
        
        toast({
          title: "Importação concluída!",
          description: summary,
        });
      } else {
        toast({
          title: "Importação concluída com erros",
          description: `${result.successCount} registros importados, ${result.errorCount} com erros.`,
          variant: "destructive",
        });
      }

      // Reset state
      setUploadedFile(null);
      setParsedData(null);
      setColumnMapping({});
      setValidationResult(null);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Não foi possível importar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedEntityData = entities.find(e => e.id === selectedEntity);

  const importEntities = [
    { id: 'accounts' as ImportEntityType, label: 'Empresas', icon: '🏢', description: 'Importar empresas/clientes' },
    { id: 'contacts' as ImportEntityType, label: 'Contatos', icon: '👤', description: 'Importar contatos' },
    { id: 'opportunities' as ImportEntityType, label: 'Oportunidades', icon: '💼', description: 'Importar oportunidades' },
    { id: 'products' as ImportEntityType, label: 'Produtos/Serviços', icon: '📦', description: 'Importar catálogo' },
    { id: 'activities' as ImportEntityType, label: 'Atividades', icon: '📅', description: 'Importar atividades' },
    { id: 'proposals' as ImportEntityType, label: 'Propostas', icon: '📄', description: 'Importar propostas' },
    { id: 'loss_reasons' as ImportEntityType, label: 'Motivos de Perda', icon: '❌', description: 'Importar motivos' },
    { id: 'origins' as ImportEntityType, label: 'Origens', icon: '🏷️', description: 'Importar origens' },
    { id: 'territories' as ImportEntityType, label: 'Territórios', icon: '🗺️', description: 'Importar territórios' },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Gestão de Dados</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Histórico, auditoria e estatísticas completas de migração
          </p>
        </div>

        {/* Import Section */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">Importar Dados</CardTitle>
                <CardDescription className="mt-2">
                  Envie arquivos CSV ou Excel para importar dados com validação IA
                </CardDescription>
              </div>
              <Upload className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Entity Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">
                  Selecione a Entidade
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowImportTemplateModal(true)}
                  className="text-xs"
                >
                  <FileDown className="mr-1 h-3 w-3" />
                  Baixar Template
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {importEntities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => setImportEntity(entity.id)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      importEntity === entity.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    <div className="text-2xl mb-2">{entity.icon}</div>
                    <div className="text-xs font-medium text-foreground mb-1">{entity.label}</div>
                    <div className="text-[10px] text-muted-foreground">{entity.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="file-upload"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: CSV, XLSX, XLS • Tamanho máximo: 10 MB • Limite: 5.000 registros
                </p>
              </label>
            </div>

            {/* Upload Button Alternative */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isProcessing}
                className="w-full md:w-auto"
                size="lg"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">Exportar Dados</CardTitle>
                <CardDescription className="mt-2">
                  Escolha a entidade e formato para exportação
                </CardDescription>
              </div>
              <Download className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Entity Selection Grid */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                Selecione a Entidade
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {entities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity.id)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedEntity === entity.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    <div className="text-2xl mb-2">{entity.icon}</div>
                    <div className="text-xs font-medium text-foreground">{entity.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground block">
                Formato de Exportação
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 ${
                    exportFormat === 'csv'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">CSV</div>
                    <div className="text-xs text-muted-foreground">Excel compatível</div>
                  </div>
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 ${
                    exportFormat === 'json'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <FileJson className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">JSON</div>
                    <div className="text-xs text-muted-foreground">Formato estruturado</div>
                  </div>
                </button>
                <button
                  onClick={() => setExportFormat('excel')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 ${
                    exportFormat === 'excel'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Excel</div>
                    <div className="text-xs text-muted-foreground">.xlsx nativo</div>
                  </div>
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-3 ${
                    exportFormat === 'pdf'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <FileText className="h-5 w-5 text-red-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">PDF</div>
                    <div className="text-xs text-muted-foreground">Documento imprimível</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-4 border-t space-y-3">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar {selectedEntityData?.label}
                  </>
                )}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTemplateModal(true)}
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Criar Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowScheduleModal(true)}
                  className="w-full"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Agendar Exportação
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import History & Stats - Phase 5 */}
        <div className="space-y-6 animate-fade-in" style={{ animationDelay: '350ms' }}>
          <ImportStatsCard />
          <ImportHistoryPanel limit={20} />
        </div>
      </div>

      {/* Modals */}
      {parsedData && (
        <ImportPreviewModal
          open={showPreviewModal}
          onOpenChange={setShowPreviewModal}
          fileName={uploadedFile?.name || ''}
          entityType={importEntity}
          headers={parsedData.headers}
          previewData={parsedData.preview}
          totalRows={parsedData.rows.length}
          initialMapping={columnMapping}
          validationResult={validationResult}
          onConfirmImport={handleConfirmImport}
          isValidating={isValidating}
        />
      )}

      <ImportResultsModal
        open={showResultsModal}
        onOpenChange={setShowResultsModal}
        result={importResult}
        fileName={uploadedFile?.name || ''}
      />

      <ImportTemplateModal
        open={showImportTemplateModal}
        onOpenChange={setShowImportTemplateModal}
      />

      <ExportTemplateModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        onSuccess={() => {
          toast({
            title: "Template criado!",
            description: "Seu template de exportação está pronto para uso.",
          });
        }}
      />

      <ScheduledExportModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        onSuccess={() => {
          toast({
            title: "Exportação agendada!",
            description: "As exportações serão enviadas automaticamente.",
          });
        }}
      />
    </Layout>
  );
}
