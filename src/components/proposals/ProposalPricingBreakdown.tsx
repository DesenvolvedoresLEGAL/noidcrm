// PRICE CORE 2.0 — Phase 2.0B
// Shared breakdown component used in editor, quick preview, public link, and PDF.
// Reads only from getProposalPricingSummary (the ledger). Never recalculates.

import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  formatLedgerBRL,
  getProposalPricingSummary,
  type ProposalPricingSummary,
} from '@/lib/proposals/pricingLedger';

interface ProposalPricingBreakdownProps {
  proposal: any;
  summary?: ProposalPricingSummary | null;
  audience?: 'public' | 'internal';
  className?: string;
  /** When true, hides the title header (use inside a card that already has a title). */
  bare?: boolean;
}

export function ProposalPricingBreakdown({
  proposal,
  summary,
  audience = 'internal',
  className,
  bare = false,
}: ProposalPricingBreakdownProps) {
  const s = summary ?? getProposalPricingSummary(proposal);
  if (!s) return null;

  const showInventory = s.inventoryAdjustmentAmount !== 0;
  const showManualDiscount = s.manualDiscount.amount > 0;
  const showDynamic = s.dynamicAdjustment.enabled && s.dynamicAdjustment.amount !== 0;
  const showRecurring = s.recurringSubtotal > 0;

  return (
    <div className={className}>
      {!bare && (
        <div className="text-sm font-semibold mb-2">Composição do valor</div>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal dos itens</span>
          <span>{formatLedgerBRL(s.subtotalItems)}</span>
        </div>

        {showManualDiscount && (
          <div className="flex justify-between text-red-600 dark:text-red-400">
            <span>
              Desconto manual
              {s.manualDiscount.percent > 0 ? ` (${s.manualDiscount.percent}%)` : ''}
            </span>
            <span>- {formatLedgerBRL(s.manualDiscount.amount)}</span>
          </div>
        )}

        {showInventory && (
          <div className="flex justify-between text-muted-foreground">
            <span>Ajuste de estoque</span>
            <span>
              {s.inventoryAdjustmentAmount >= 0 ? '+ ' : '- '}
              {formatLedgerBRL(Math.abs(s.inventoryAdjustmentAmount))}
            </span>
          </div>
        )}

        <Separator className="my-1" />

        <div className="flex justify-between font-medium">
          <span>Base comercial</span>
          <span>{formatLedgerBRL(s.baseAmount)}</span>
        </div>

        {showDynamic && (
          <div className="flex justify-between text-amber-600 dark:text-amber-400">
            <span>
              Ajuste dinâmico
              {s.dynamicAdjustment.percent !== 0
                ? ` (${s.dynamicAdjustment.percent >= 0 ? '+' : ''}${s.dynamicAdjustment.percent}%)`
                : ''}
              {s.dynamicAdjustment.tierLabel ? ` — ${s.dynamicAdjustment.tierLabel}` : ''}
            </span>
            <span>
              {s.dynamicAdjustment.amount >= 0 ? '+ ' : '- '}
              {formatLedgerBRL(Math.abs(s.dynamicAdjustment.amount))}
            </span>
          </div>
        )}

        {showRecurring && (
          <div className="flex justify-between text-muted-foreground">
            <span>Recorrência (acumulada)</span>
            <span>{formatLedgerBRL(s.recurringSubtotal)}</span>
          </div>
        )}

        <Separator className="my-1" />

        <div className="flex justify-between font-bold text-base">
          <span>Valor vigente</span>
          <span className="text-primary">{formatLedgerBRL(s.effectiveAmount)}</span>
        </div>

        {audience === 'internal' && s.paymentScheduleTotal !== s.effectiveAmount && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Total do cronograma</span>
            <span>{formatLedgerBRL(s.paymentScheduleTotal)}</span>
          </div>
        )}

        {audience === 'internal' && s.hasDivergence && (
          <div className="flex items-start gap-2 mt-2 p-2 rounded-md border border-destructive/30 bg-destructive/5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Divergência detectada entre valor vigente e cronograma. Recalcule a proposta
              antes de enviar ao ERP ou aprovar.
            </span>
          </div>
        )}

        {audience === 'internal' && s.frozen && (
          <Badge variant="outline" className="mt-2 text-[10px]">
            Valor congelado na aprovação
          </Badge>
        )}
      </div>
    </div>
  );
}
