import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { exportData } from '@/services/crm/data-export';
import { Badge } from '@/components/ui/badge';

type EntityType = 'opportunities' | 'accounts' | 'contacts' | 'products' | 'activities';
type ExportFormat = 'csv' | 'json';

const entities = [
  { id: 'opportunities' as EntityType, label: 'Oportunidades', icon: '💼', color: 'bg-blue-500/10 text-blue-600' },
  { id: 'accounts' as EntityType, label: 'Empresas', icon: '🏢', color: 'bg-green-500/10 text-green-600' },
  { id: 'contacts' as EntityType, label: 'Contatos', icon: '👤', color: 'bg-purple-500/10 text-purple-600' },
  { id: 'products' as EntityType, label: 'Produtos/Serviços', icon: '📦', color: 'bg-orange-500/10 text-orange-600' },
  { id: 'activities' as EntityType, label: 'Atividades', icon: '📅', color: 'bg-pink-500/10 text-pink-600' },
];

export default function DataManagement() {
  const { toast } = useToast();
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('opportunities');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);

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

  const selectedEntityData = entities.find(e => e.id === selectedEntity);

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Gestão de Dados</h1>
            <Badge variant="secondary" className="text-xs">Sprint 1</Badge>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Exporte dados do CRM em CSV ou JSON
          </p>
        </div>

        {/* Export Section */}
        <Card className="shadow-card animate-fade-in" style={{ animationDelay: '100ms' }}>
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-4 border-t">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full md:w-auto"
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
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Formatos Suportados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">CSV, JSON</div>
              <p className="text-xs text-muted-foreground mt-1">
                Excel e APIs
              </p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '250ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entidades Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">5</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tipos de dados
              </p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Próximas Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">Sprint 2</div>
              <p className="text-xs text-muted-foreground mt-1">
                Importação de dados
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
