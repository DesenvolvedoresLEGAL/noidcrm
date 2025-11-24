import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';

interface ImportProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportProductsModal({ open, onOpenChange, onSuccess }: ImportProductsModalProps) {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validar tipo
      if (!file.name.endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Arquivo inválido',
          description: 'Por favor, selecione um arquivo CSV.',
        });
        return;
      }

      setImporting(true);
      setResults(null);

      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (result) => {
          try {
            // Mapear colunas
            const products = result.data.map((row: any) => ({
              name: row['Nome'] || row['name'],
              type: (row['Tipo'] || row['type'] || 'produto').toLowerCase() === 'serviço' ? 'servico' : 'produto',
              code: row['Código'] || row['code'] || '',
              reference: row['Referência'] || row['reference'] || '',
              category: row['Categoria'] || row['category'] || '',
              description: row['Descrição'] || row['description'] || '',
              unit: row['Unidade'] || row['unit'] || 'un',
              cost: parseFloat(row['Custo'] || row['cost'] || '0') || null,
              price: parseFloat(row['Preço'] || row['price'] || '0') || null,
              ipi_percent: parseFloat(row['IPI %'] || row['ipi_percent'] || '0') || 0,
              active: (row['Status'] || row['active'] || 'ativo').toLowerCase() !== 'inativo',
            }));

            // Chamar edge function
            const { data, error } = await supabase.functions.invoke('import-products', {
              body: { products },
            });

            if (error) throw error;

            setResults(data);

            if (data.success > 0) {
              toast({
                title: 'Importação concluída',
                description: `${data.success} produto(s) importado(s) com sucesso.`,
              });
              onSuccess();
            }

            if (data.errors.length > 0) {
              toast({
                variant: 'destructive',
                title: 'Alguns erros ocorreram',
                description: `${data.errors.length} erro(s) encontrado(s).`,
              });
            }
          } catch (error: any) {
            console.error('Import error:', error);
            toast({
              variant: 'destructive',
              title: 'Erro na importação',
              description: error.message,
            });
          } finally {
            setImporting(false);
          }
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          toast({
            variant: 'destructive',
            title: 'Erro ao ler arquivo',
            description: 'Não foi possível processar o arquivo CSV.',
          });
          setImporting(false);
        },
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Produtos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>Formato CSV esperado:</strong>
                  <br />
                  Nome, Tipo, Código, Referência, Categoria, Descrição, Unidade, Custo, Preço, IPI %, Status
                </p>
                <p className="text-xs text-muted-foreground">
                  Máximo de 1000 produtos por importação.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const template = `Nome,Tipo,Código,Referência,Categoria,Descrição,Unidade,Custo,Preço,IPI %,Status
Produto Exemplo 1,produto,PROD-001,REF-001,Eletrônicos,Descrição do produto 1,un,100.00,150.00,10,Ativo
Serviço Exemplo 1,servico,SERV-001,REF-002,Serviços,Descrição do serviço 1,hr,50.00,100.00,0,Ativo`;
                    
                    const blob = new Blob([template], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'template_importacao_produtos.csv';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }}
                >
                  Baixar Template CSV
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          {!results && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50">
              <input
                type="file"
                id="csv-upload"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {importing ? 'Importando...' : 'Clique para selecionar um arquivo CSV'}
                </p>
              </label>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription>
                  <strong>{results.success} produto(s) importado(s) com sucesso</strong>
                </AlertDescription>
              </Alert>

              {results.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <AlertDescription>
                    <strong>Avisos ({results.warnings.length}):</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {results.warnings.slice(0, 10).map((warning: string, i: number) => (
                        <li key={i} className="text-xs">{warning}</li>
                      ))}
                      {results.warnings.length > 10 && (
                        <li className="text-xs text-muted-foreground">
                          ... e mais {results.warnings.length - 10} avisos
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Erros ({results.errors.length}):</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {results.errors.slice(0, 10).map((error: string, i: number) => (
                        <li key={i} className="text-xs">{error}</li>
                      ))}
                      {results.errors.length > 10 && (
                        <li className="text-xs">
                          ... e mais {results.errors.length - 10} erros
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResults(null);
                  }}
                >
                  Nova Importação
                </Button>
                <Button onClick={() => onOpenChange(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
