import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Download,
  MessageCircle,
  Calendar,
  CreditCard,
  Receipt,
  FileText,
  User,
} from 'lucide-react';
import { formatDateBR } from '@/lib/dateUtils';

interface ScheduleItem {
  number?: number;
  dueDate?: string;
  amount?: number;
  type?: 'upfront' | 'entry' | 'balance' | 'installment' | string;
  label?: string;
}

interface Props {
  proposal: any;
  items: any[];
  installments: ScheduleItem[];
  publicPaymentEnabled: boolean;
  onDownloadPDF: () => void;
  downloadingPDF?: boolean;
  contactConsultantHref?: string | null;
}

function formatBRL(value?: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export function PublicProposalApprovedScreen({
  proposal,
  items,
  installments,
  publicPaymentEnabled,
  onDownloadPDF,
  downloadingPDF,
  contactConsultantHref,
}: Props) {
  const snap = (proposal?.approval_snapshot ?? {}) as any;
  const dynSnap = snap?.dynamic_pricing ?? {};
  const approvedAmount =
    snap?.approved_amount ?? proposal?.approved_amount ?? proposal?.dynamic_pricing_current_amount ?? proposal?.total_amount;
  const consultant = snap?.consultant ?? {};
  const paymentMethod = snap?.payment_method ?? null;
  const paymentCondition = snap?.payment_condition ?? 'upfront';

  const conditionLabel: Record<string, string> = {
    upfront: 'Pagamento à vista',
    split_50_50: '50% + 50%',
    split_30_70: '30% + 70%',
    installments: 'Parcelado',
    custom_schedule: 'Cronograma customizado',
  };

  const renderedSchedule: ScheduleItem[] =
    Array.isArray(snap?.payment_schedule) && snap.payment_schedule.length > 0
      ? snap.payment_schedule
      : installments;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Hero */}
      <Card className="border-2 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="py-6 md:py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl md:text-3xl font-bold text-green-900">
                Proposta aprovada com sucesso
              </h2>
              <p className="text-sm md:text-base text-green-800 mt-1">
                Recebemos sua aprovação com as condições comerciais abaixo.
              </p>
              <p className="text-xs text-green-700 mt-2">
                Aprovada em {formatDateBR(proposal?.accepted_at)} por {proposal?.acceptor_name ?? '—'}
              </p>
            </div>
            <Badge variant="default" className="bg-green-600 text-white">
              Proposta #{proposal?.proposal_number ?? proposal?.id?.slice(0, 8)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Resumo da aprovação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground">Cliente</div>
              <div className="font-medium">
                {proposal?.client_name ?? proposal?.account?.razao_social ?? '—'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground">Valor aprovado</div>
              <div className="text-2xl font-bold text-primary">{formatBRL(Number(approvedAmount))}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground">Validade da proposta</div>
              <div className="font-medium">{proposal?.expires_at ? formatDateBR(proposal.expires_at) : '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground">Forma de pagamento</div>
              <div className="font-medium uppercase">{paymentMethod ?? '—'}</div>
            </div>
          </div>

          {dynSnap?.enabled && (
            <>
              <Separator />
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
                  Condição comercial vigente aplicada
                  {dynSnap?.price_frozen_on_approval && (
                    <Badge variant="secondary" className="text-[10px]">Preço congelado na aprovação</Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Faixa</div>
                    <div className="font-medium">{dynSnap.current_label ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ajuste</div>
                    <div className="font-medium">{dynSnap.current_adjustment ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Validade da condição</div>
                    <div className="font-medium">
                      {dynSnap.current_valid_until ? formatDateBR(dynSnap.current_valid_until) : '—'}
                    </div>
                  </div>
                  {dynSnap?.reference_type && (
                    <>
                      <div>
                        <div className="text-muted-foreground">Calculado por</div>
                        <div className="font-medium">
                          {dynSnap.reference_type === 'current_date' && 'Data atual'}
                          {dynSnap.reference_type === 'payment_due_date' && 'Data prevista de pagamento'}
                          {dynSnap.reference_type === 'custom_date' && 'Data personalizada'}
                          {dynSnap.reference_type === 'approval_date' && 'Data da aprovação'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Data de referência</div>
                        <div className="font-medium">
                          {dynSnap.reference_date ? formatDateBR(dynSnap.reference_date) : '—'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Condição + Cronograma */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Condição de pagamento aprovada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="secondary">{conditionLabel[paymentCondition] ?? paymentCondition}</Badge>

          {renderedSchedule.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-xs uppercase text-muted-foreground mb-3">Cronograma aprovado</div>
              <div className="space-y-2">
                {renderedSchedule.map((inst, idx) => {
                  const label = inst.label
                    ?? (inst.type === 'upfront' ? 'Pagamento à vista'
                      : inst.type === 'entry' ? 'Entrada'
                      : inst.type === 'balance' ? 'Saldo'
                      : `Parcela ${inst.number ?? idx + 1}`);
                  return (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{label}</Badge>
                        <span className="text-sm">{inst.dueDate ? formatDateBR(inst.dueDate) : '—'}</span>
                      </div>
                      <span className="font-semibold">{formatBRL(inst.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!publicPaymentEnabled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
              A cobrança será enviada pela equipe LEGAL conforme a condição aprovada.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Itens contratados */}
      {items?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" /> Itens contratados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between items-start py-2 border-b border-border/50 last:border-0">
                  <div className="min-w-0 pr-3">
                    <div className="font-medium truncate">{it.product_name ?? it.description ?? '—'}</div>
                    {it.description && it.product_name && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{it.description}</div>
                    )}
                  </div>
                  <div className="text-sm whitespace-nowrap font-semibold">{formatBRL(Number(it.total ?? 0))}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consultor */}
      {(consultant?.name || consultant?.email || consultant?.phone) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Consultor responsável
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {consultant.name && <div className="font-medium">{consultant.name}</div>}
            {consultant.email && <div className="text-muted-foreground">{consultant.email}</div>}
            {consultant.phone && <div className="text-muted-foreground">{consultant.phone}</div>}
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onDownloadPDF} disabled={downloadingPDF} className="gap-2">
          <Download className="h-4 w-4" />
          {downloadingPDF ? 'Gerando PDF…' : 'Baixar PDF da proposta aprovada'}
        </Button>
        {contactConsultantHref && (
          <Button asChild variant="outline" className="gap-2">
            <a href={contactConsultantHref} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Falar com consultor
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
