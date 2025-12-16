import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { listWinReasons, type WinReason } from '@/services/crm/win-reasons';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyFull } from '@/lib/i18n';
import { Trophy, DollarSign, Percent, User, Sparkles, MessageSquare, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WinDetails {
  winReasonId: string;
  finalValue: number;
  discountPercent?: number;
  championContactId?: string;
  keyDifferentiator?: 'price' | 'product' | 'service' | 'brand' | 'relationship' | 'timing';
  customerFeedback?: string;
  negotiationRounds?: number;
}

interface WinReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (details: WinDetails) => void;
  opportunityTitle: string;
  opportunityValue?: number;
  accountId?: string;
  pipelineId: string | null;
  opportunityId: string;
}

interface Contact {
  id: string;
  nome: string;
  cargo?: string;
}

export function WinReasonModal({
  open,
  onClose,
  onConfirm,
  opportunityTitle,
  opportunityValue,
  accountId,
  pipelineId,
  opportunityId,
}: WinReasonModalProps) {
  const [winReasons, setWinReasons] = useState<WinReason[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [finalValue, setFinalValue] = useState<number>(opportunityValue || 0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [championContactId, setChampionContactId] = useState('');
  const [keyDifferentiator, setKeyDifferentiator] = useState<string>('');
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [negotiationRounds, setNegotiationRounds] = useState(1);
  const [loading, setLoading] = useState(false);
  const [salesCycleDays, setSalesCycleDays] = useState<number>(0);
  const [interactionsCount, setInteractionsCount] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open, pipelineId, accountId, opportunityId]);

  const resetForm = () => {
    setSelectedReasonId('');
    setFinalValue(opportunityValue || 0);
    setDiscountPercent(0);
    setChampionContactId('');
    setKeyDifferentiator('');
    setCustomerFeedback('');
    setNegotiationRounds(1);
  };

  const loadData = async () => {
    try {
      // Load win reasons
      const reasons = await listWinReasons(pipelineId);
      setWinReasons(reasons);

      // Load contacts for this account
      if (accountId) {
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, nome, cargo')
          .eq('account_id', accountId);
        setContacts(contactsData || []);
      }

      // Get opportunity stats
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('created_at')
        .eq('id', opportunityId)
        .single();
      
      if (oppData) {
        const days = Math.floor((Date.now() - new Date(oppData.created_at).getTime()) / (1000 * 60 * 60 * 24));
        setSalesCycleDays(days);
      }

      // Get interactions count
      const { count } = await supabase
        .from('interactions')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityId);
      setInteractionsCount(count || 0);

      // Calculate discount if value changed
      if (opportunityValue && opportunityValue > 0) {
        setFinalValue(opportunityValue);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    // Auto-calculate discount percent
    if (opportunityValue && opportunityValue > 0 && finalValue > 0) {
      const discount = ((opportunityValue - finalValue) / opportunityValue) * 100;
      setDiscountPercent(Math.max(0, Math.round(discount * 100) / 100));
    }
  }, [finalValue, opportunityValue]);

  const handleConfirm = () => {
    if (!selectedReasonId) {
      toast({
        title: 'Atenção',
        description: 'Selecione o motivo do ganho',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    onConfirm({
      winReasonId: selectedReasonId,
      finalValue,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      championContactId: championContactId || undefined,
      keyDifferentiator: keyDifferentiator as WinDetails['keyDifferentiator'],
      customerFeedback: customerFeedback.trim() || undefined,
      negotiationRounds,
    });
  };

  const differentiators = [
    { value: 'price', label: 'Preço', icon: DollarSign, color: 'text-green-500' },
    { value: 'product', label: 'Produto', icon: Sparkles, color: 'text-blue-500' },
    { value: 'service', label: 'Atendimento', icon: User, color: 'text-purple-500' },
    { value: 'brand', label: 'Marca', icon: Trophy, color: 'text-yellow-500' },
    { value: 'relationship', label: 'Relacionamento', icon: MessageSquare, color: 'text-pink-500' },
    { value: 'timing', label: 'Timing', icon: Clock, color: 'text-orange-500' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <Trophy className="h-5 w-5" />
            Registrar Ganho
          </DialogTitle>
          <DialogDescription className="truncate">
            {opportunityTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Stats Banner */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span><strong>{salesCycleDays}</strong> dias</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span><strong>{interactionsCount}</strong> interações</span>
            </div>
          </div>

          {/* Win Reason */}
          <div className="space-y-2">
            <Label htmlFor="win-reason">Por que ganhamos? *</Label>
            <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo principal" />
              </SelectTrigger>
              <SelectContent>
                {winReasons.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum motivo cadastrado
                  </SelectItem>
                ) : (
                  winReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Value and Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="final-value">Valor Final Negociado</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="final-value"
                  type="number"
                  step="0.01"
                  value={finalValue}
                  onChange={(e) => setFinalValue(parseFloat(e.target.value) || 0)}
                  className="pl-10"
                />
              </div>
              {opportunityValue && opportunityValue !== finalValue && (
                <p className="text-xs text-muted-foreground">
                  Original: {formatCurrencyFull(opportunityValue)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">Desconto dado</Label>
              <div className="relative">
                <Input
                  id="discount"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="pr-8"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Champion Contact */}
          <div className="space-y-2">
            <Label htmlFor="champion">Quem foi o champion/decisor?</Label>
            <Select value={championContactId} onValueChange={setChampionContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o contato decisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Não informado</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.nome} {contact.cargo && `- ${contact.cargo}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Negotiation Rounds */}
          <div className="space-y-2">
            <Label>Rodadas de negociação</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant={negotiationRounds === num ? 'default' : 'outline'}
                  size="sm"
                  className="w-10"
                  onClick={() => setNegotiationRounds(num)}
                >
                  {num}
                </Button>
              ))}
              <Button
                type="button"
                variant={negotiationRounds > 5 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNegotiationRounds(6)}
              >
                6+
              </Button>
            </div>
          </div>

          {/* Key Differentiator */}
          <div className="space-y-3">
            <Label>Diferencial decisivo</Label>
            <RadioGroup value={keyDifferentiator} onValueChange={setKeyDifferentiator}>
              <div className="grid grid-cols-3 gap-2">
                {differentiators.map((diff) => (
                  <div
                    key={diff.value}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                      keyDifferentiator === diff.value 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => setKeyDifferentiator(diff.value)}
                  >
                    <RadioGroupItem value={diff.value} id={diff.value} className="sr-only" />
                    <diff.icon className={cn("h-4 w-4", diff.color)} />
                    <span className="text-sm font-medium">{diff.label}</span>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Customer Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback do cliente (opcional)</Label>
            <Textarea
              id="feedback"
              value={customerFeedback}
              onChange={(e) => setCustomerFeedback(e.target.value.slice(0, 280))}
              placeholder="O que o cliente disse sobre a decisão?"
              rows={2}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground text-right">
              {customerFeedback.length}/280
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !selectedReasonId}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Confirmando...' : '🎉 Confirmar Ganho'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
