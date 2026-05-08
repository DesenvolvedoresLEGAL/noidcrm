import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { replaceVariables, VariableContext } from '@/lib/proposalVariables';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Eye, Package, CreditCard } from 'lucide-react';
import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm } from '@/services/crm/proposal-payment-terms';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PublicProposalDynamicPricingBanner } from './PublicProposalDynamicPricingBanner';

interface ProposalPreviewProps {
  proposalId?: string;
  opportunityId?: string;
  content: {
    introduction?: string;
    terms?: string;
    notes?: string;
  };
  items?: ProposalItem[];
  paymentTerms?: PaymentTerm[];
  totalValue?: number;
  currency?: string;
  paymentDiscountPercent?: number;
}

export function ProposalPreview({ 
  proposalId, 
  opportunityId, 
  content,
  items = [],
  paymentTerms = [],
  totalValue = 0,
  currency = 'BRL',
  paymentDiscountPercent = 0
}: ProposalPreviewProps) {
  // Load context data for variable replacement
  const { data: context } = useQuery({
    queryKey: ['proposal-context', proposalId, opportunityId],
    queryFn: async () => {
      const ctx: VariableContext = {};

      // Load organization
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (orgId) {
        const { data: organization } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        if (organization) {
          ctx.organization = {
            name: organization.name,
            cnpj: organization.cnpj,
            legal_name: organization.legal_name,
            address_street: organization.address_street,
            address_number: organization.address_number,
            address_complement: organization.address_complement,
            address_city: organization.address_city,
            address_state: organization.address_state,
            address_zip: organization.address_zip,
            phone: organization.phone,
            email: organization.email,
            website: organization.website,
          };
        }
      }

      // Load proposal data
      if (proposalId) {
        const { data: proposal } = await supabase
          .from('proposals')
          .select('*, opportunity:opportunities(*)')
          .eq('id', proposalId)
          .single();

        if (proposal) {
          ctx.proposal = {
            title: proposal.title,
            id: proposal.id,
            version: proposal.version,
            created_at: proposal.created_at,
            expires_at: proposal.expires_at,
            total_amount: proposal.total_amount,
            subtotal: proposal.subtotal,
          };

          // Load account and contact from opportunity
          if (proposal.opportunity) {
            const opp = proposal.opportunity as any;
            
            if (opp.account_id) {
              const { data: account } = await supabase
                .from('accounts')
                .select('*')
                .eq('id', opp.account_id)
                .single();
              
              if (account) {
                ctx.account = account;
              }
            }

            if (opp.contact_id) {
              const { data: contact } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', opp.contact_id)
                .single();
              
              if (contact) {
                ctx.contact = contact as unknown as VariableContext['contact'];
              }
            }

            // Load owner
            if (opp.owner_user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', opp.owner_user_id)
                .single();
              
              if (profile) {
                ctx.owner = profile;
              }
            }
          }
        }
      } else if (opportunityId) {
        // Load opportunity data for new proposal
        const { data: opp } = await supabase
          .from('opportunities')
          .select('*')
          .eq('id', opportunityId)
          .single();

        if (opp) {
          if (opp.account_id) {
            const { data: account } = await supabase
              .from('accounts')
              .select('*')
              .eq('id', opp.account_id)
              .single();
            
            if (account) ctx.account = account;
          }

          if (opp.contact_id) {
            const { data: contact } = await supabase
              .from('contacts')
              .select('*')
              .eq('id', opp.contact_id)
              .single();
            
            if (contact) ctx.contact = contact as unknown as VariableContext['contact'];
          }

          if (opp.owner_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', opp.owner_user_id)
              .single();
            
            if (profile) ctx.owner = profile;
          }
        }
      }

      return ctx;
    },
    enabled: !!(proposalId || opportunityId),
  });

  // Load items from DB if proposalId provided and no items passed
  const { data: dbItems = [] } = useQuery({
    queryKey: ['proposal-items-preview', proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposal_items')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('order_index');
      return data || [];
    },
    enabled: !!proposalId && items.length === 0,
  });

  // Load payment terms from DB if proposalId provided and no terms passed
  const { data: dbPaymentTerms = [] } = useQuery({
    queryKey: ['proposal-payment-terms-preview', proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposal_payment_terms')
        .select('*')
        .eq('proposal_id', proposalId!);
      return data || [];
    },
    enabled: !!proposalId && paymentTerms.length === 0,
  });

  // Load dynamic pricing snapshot for current commercial condition card
  const { data: dynamicPricing } = useQuery({
    queryKey: ['proposal-dynamic-pricing-preview', proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('dynamic_pricing_enabled, dynamic_pricing_snapshot')
        .eq('id', proposalId!)
        .maybeSingle();
      return data;
    },
    enabled: !!proposalId,
  });

  const displayItems = items.length > 0 ? items : dbItems;
  const displayPaymentTerms = paymentTerms.length > 0 ? paymentTerms : dbPaymentTerms;
  
  // Calculate totals from items
  const calculatedSubtotal = displayItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  
  // Separate by billing type
  const oneTimeItems = displayItems.filter(item => (item.billing_type || 'one_time') !== 'recurring');
  const recurringItems = displayItems.filter(item => item.billing_type === 'recurring');
  
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
  const recurringTotal = recurringItems.reduce((sum, item) => sum + item.total, 0);
  
  // Apply payment discount to one-time total
  const paymentDiscountAmount = oneTimeTotal * (paymentDiscountPercent / 100);
  const oneTimeWithDiscount = oneTimeTotal - paymentDiscountAmount;
  
  // Calculate contract total for recurring (assume 12 months)
  const contractMonths = 12;
  const recurringContractTotal = recurringTotal * contractMonths;
  
  // Grand total with discount applied
  const calculatedTotal = oneTimeWithDiscount + recurringContractTotal;
  const displayTotal = totalValue || calculatedTotal;

  const processedContent = context ? {
    introduction: replaceVariables(content.introduction || '', context),
    terms: replaceVariables(content.terms || '', context),
    notes: replaceVariables(content.notes || '', context),
  } : content;

  const formatCurrency = (value: number) => {
    const symbols: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' };
    return `${symbols[currency] || 'R$'} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  // Strip HTML tags for cleaner preview
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const hasContent = content.introduction || content.terms || content.notes || displayItems.length > 0;

  if (!hasContent) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Eye className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum conteúdo para visualizar</p>
          <p className="text-sm">Adicione introdução, itens ou termos para ver a prévia da proposta.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Pré-visualização da Proposta
            </CardTitle>
            <Badge variant="secondary">Preview</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Introduction */}
      {processedContent.introduction && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Introdução</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedContent.introduction) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      {displayItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Itens da Proposta ({displayItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Item</th>
                    <th className="text-center py-2 font-medium w-20">Qtd</th>
                    <th className="text-right py-2 font-medium w-28">Preço Un.</th>
                    <th className="text-right py-2 font-medium w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-border/50">
                      <td className="py-3">
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {stripHtml(item.description)}
                          </div>
                        )}
                      </td>
                      <td className="text-center py-3">{item.quantity}</td>
                      <td className="text-right py-3">{formatCurrency(item.unit_price)}</td>
                      <td className="text-right py-3 font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={3} className="py-3 text-right font-medium">Subtotal:</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(calculatedSubtotal)}</td>
                  </tr>
                  {paymentDiscountPercent > 0 && oneTimeTotal > 0 && (
                    <tr className="text-red-600">
                      <td colSpan={3} className="py-2 text-right font-medium">Desconto ({paymentDiscountPercent}%):</td>
                      <td className="py-2 text-right font-medium">- {formatCurrency(paymentDiscountAmount)}</td>
                    </tr>
                  )}
                  <tr className="text-lg">
                    <td colSpan={3} className="py-2 text-right font-bold">Total:</td>
                    <td className="py-2 text-right font-bold text-primary">{formatCurrency(displayTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Condição comercial vigente */}
      {dynamicPricing?.dynamic_pricing_enabled && (
        <PublicProposalDynamicPricingBanner
          snapshot={dynamicPricing.dynamic_pricing_snapshot as any}
          variant="preview"
        />
      )}

      {/* Payment Terms */}
      {displayPaymentTerms.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Condições de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayPaymentTerms.map((term, idx) => (
                <div key={term.id || idx} className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="font-medium flex items-center gap-2">
                    {term.payment_type === 'one_time' ? (
                      <>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">Avulso</Badge>
                        Pagamento Único
                      </>
                    ) : (
                      <>
                        <Badge className="bg-emerald-500">MRR</Badge>
                        Pagamento Recorrente
                      </>
                    )}
                  </div>
                  {term.payment_type === 'one_time' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {term.entry_percent > 0 && (
                        <div><span className="text-muted-foreground">Entrada:</span> {term.entry_percent}%</div>
                      )}
                      <div><span className="text-muted-foreground">Parcelas:</span> {term.installments || 1}x</div>
                      {term.discount_percent > 0 && (
                        <div><span className="text-muted-foreground">Desconto:</span> {term.discount_percent}%</div>
                      )}
                      {term.first_installment_date && (
                        <div><span className="text-muted-foreground">Início:</span> {format(new Date(term.first_installment_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Contrato:</span> {(term as any).contract_months || 12} meses</div>
                        {((term as any).first_payment_date || (term as any).contract_start_date) && (
                          <div><span className="text-muted-foreground">Início:</span> {format(new Date(((term as any).first_payment_date || (term as any).contract_start_date) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</div>
                        )}
                        <div><span className="text-muted-foreground">Vencimento:</span> Dia {(term as any).recurring_due_day || (term as any).billing_day || 10}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">MRR</p>
                          <p className="font-bold text-emerald-600">{formatCurrency(term.monthly_value || 0)}/mês</p>
                        </div>
                        <div className="text-center border-x border-emerald-200 dark:border-emerald-800">
                          <p className="text-[10px] text-muted-foreground">Contrato</p>
                          <p className="font-bold">{formatCurrency(term.contract_total || (term.monthly_value || 0) * ((term as any).contract_months || 12))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">ARR</p>
                          <p className="font-bold">{formatCurrency((term.monthly_value || 0) * 12)}/ano</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terms and Conditions */}
      {processedContent.terms && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Termos e Condições</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedContent.terms) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {processedContent.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedContent.notes) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Total Summary */}
      {displayTotal > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Valor Total da Proposta</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(displayTotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
