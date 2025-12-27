import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, FileText, Package, CreditCard, AlertCircle } from 'lucide-react';
import { replaceVariables, VariableContext } from '@/lib/proposalVariables';
import { sanitizeHtmlWithLineBreaks, sanitizeHtml } from '@/lib/sanitizeHtml';

interface TemplatePreviewTabProps {
  templateData: any;
}

// Mock data for preview
const MOCK_CONTEXT: VariableContext = {
  organization: {
    name: 'Minha Empresa LTDA',
    cnpj: '12345678000199',
    legal_name: 'Minha Empresa LTDA',
    address_street: 'Rua Exemplo',
    address_number: '123',
    address_city: 'São Paulo',
    address_state: 'SP',
    phone: '11999999999',
    email: 'contato@minhaempresa.com.br',
    website: 'www.minhaempresa.com.br',
  },
  account: {
    razao_social: 'Cliente Exemplo S.A.',
    nome_fantasia: 'Cliente Exemplo',
    cnpj: '98765432000188',
    segmento: 'Tecnologia',
    tamanho: 'Média',
  },
  contact: {
    nome: 'João Silva',
    emails: [{ value: 'joao@cliente.com', type: 'work', is_primary: true }],
    telefones: [{ value: '11988887777', type: 'mobile', is_primary: true }],
    cargo: 'Diretor Comercial',
  },
  proposal: {
    title: 'Proposta Comercial',
    proposal_number: 'PROP-2025-00001',
    proposal_version: 1,
    currency: 'BRL',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    total_amount: 15000,
  },
  owner: {
    full_name: 'Maria Santos',
    email: 'maria@minhaempresa.com.br',
    phone: '11977776666',
  },
};

export function TemplatePreviewTab({ templateData }: TemplatePreviewTabProps) {
  const processedIntroduction = templateData.introduction 
    ? replaceVariables(templateData.introduction, MOCK_CONTEXT)
    : '';
  
  const processedTerms = templateData.terms 
    ? replaceVariables(templateData.terms, MOCK_CONTEXT)
    : '';
  
  const processedObservations = templateData.observations 
    ? replaceVariables(templateData.observations, MOCK_CONTEXT)
    : '';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: templateData.currency || 'BRL',
    }).format(value);
  };

  const hasContent = templateData.introduction || templateData.terms || 
    templateData.observations || (templateData.default_items && templateData.default_items.length > 0);

  if (!hasContent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Adicione conteúdo ao template para visualizar a prévia
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Prévia do Template</CardTitle>
              <CardDescription>
                Visualização com dados de exemplo - variáveis serão substituídas automaticamente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Header Preview */}
          <div className="bg-muted/50 p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{templateData.name || 'Template sem nome'}</h2>
                <p className="text-sm text-muted-foreground">{templateData.description}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline">{templateData.currency || 'BRL'}</Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  Validade: {templateData.validity_days || 15} dias
                </p>
              </div>
            </div>
          </div>

          {/* Introduction */}
          {processedIntroduction && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Introdução</h3>
              </div>
              <div 
                className="prose prose-sm max-w-none text-muted-foreground bg-card p-4 rounded-lg border"
                dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithLineBreaks(processedIntroduction) }}
              />
            </div>
          )}

          {/* Items */}
          {templateData.default_items && templateData.default_items.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Itens</h3>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-center p-3">Qtd</th>
                      <th className="text-right p-3">Valor Unit.</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateData.default_items.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.name || 'Item sem nome'}</td>
                        <td className="text-center p-3">{item.quantity}</td>
                        <td className="text-right p-3">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right p-3 font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={3} className="p-3 text-right font-semibold">Total:</td>
                      <td className="p-3 text-right font-bold">
                        {formatCurrency(
                          templateData.default_items.reduce(
                            (acc: number, item: any) => acc + (item.quantity * item.unit_price), 
                            0
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Payment Info */}
          {(templateData.payment_method_default || templateData.payment_comment) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Condições de Pagamento</h3>
              </div>
              <div className="bg-card p-4 rounded-lg border space-y-2 text-sm">
                {templateData.payment_method_default && (
                  <p><span className="text-muted-foreground">Forma:</span> {templateData.payment_method_default}</p>
                )}
                {templateData.installments_default > 1 && (
                  <p><span className="text-muted-foreground">Parcelas:</span> {templateData.installments_default}x</p>
                )}
                {templateData.entry_percent_default > 0 && (
                  <p><span className="text-muted-foreground">Entrada:</span> {templateData.entry_percent_default}%</p>
                )}
                {templateData.discount_percent_default > 0 && (
                  <p><span className="text-muted-foreground">Desconto:</span> {templateData.discount_percent_default}%</p>
                )}
                {templateData.payment_comment && (
                  <div 
                    className="mt-3 pt-3 border-t text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(templateData.payment_comment) }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Terms */}
          {processedTerms && (
            <div className="mb-6">
              <Separator className="my-6" />
              <h3 className="font-semibold mb-3">Termos e Condições</h3>
              <div 
                className="prose prose-sm max-w-none text-muted-foreground bg-card p-4 rounded-lg border"
                dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithLineBreaks(processedTerms) }}
              />
            </div>
          )}

          {/* Observations */}
          {processedObservations && (
            <div>
              <Separator className="my-6" />
              <h3 className="font-semibold mb-3">Observações</h3>
              <div 
                className="prose prose-sm max-w-none text-muted-foreground bg-card p-4 rounded-lg border"
                dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithLineBreaks(processedObservations) }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
