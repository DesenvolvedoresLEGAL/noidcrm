import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, MessageSquareWarning, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SDRCopilotChannel, SDRCopilotTask } from '@/services/intelligence/sdrCopilot';
import { CHANNEL_LABEL } from '@/services/intelligence/sdrCopilot';

const OBJECTION_TYPES: Array<{ value: string; label: string }> = [
  { value: 'price_objection', label: 'Preço / caro demais' },
  { value: 'existing_supplier', label: 'Já tenho fornecedor' },
  { value: 'already_has_provider', label: 'Já contratou concorrente' },
  { value: 'no_time', label: 'Sem tempo agora' },
  { value: 'send_proposal_first', label: 'Manda proposta antes' },
  { value: 'not_interested_now', label: 'Sem interesse no momento' },
];

const TONES = [
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'direto', label: 'Direto' },
  { value: 'cordial', label: 'Cordial' },
];

const CHANNELS: SDRCopilotChannel[] = ['whatsapp', 'email', 'linkedin', 'call'];

interface Props {
  task: SDRCopilotTask;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface ObjectionResult {
  response: string;
  follow_up_question: string;
  recommended_next_step: string;
  confidence: number;
  skill_slug?: string;
  run_id?: string;
}

export function ObjectionResponseModal({ task, open, onOpenChange }: Props) {
  const brief = (task.commercial_brief ?? {}) as Record<string, any>;
  const [objectionType, setObjectionType] = useState<string>('price_objection');
  const [customerMessage, setCustomerMessage] = useState('');
  const [tone, setTone] = useState('consultivo');
  const [channel, setChannel] = useState<SDRCopilotChannel>(task.preferred_channel ?? 'whatsapp');
  const [desiredNextStep, setDesiredNextStep] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ObjectionResult | null>(null);

  const handleRun = async () => {
    if (!customerMessage.trim()) {
      toast.error('Cole a mensagem do cliente para gerar a resposta.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('noid-skill-router', {
        body: {
          source_module: 'sdr_copilot',
          goal: 'handle_objection',
          context: {
            objection_type: objectionType,
            customer_message: customerMessage.trim(),
            company_context: brief.company_name ? `${brief.company_name} — ${brief.pain ?? ''}`.trim() : '',
            event_context: brief.event_name ?? brief.event ?? '',
            product_context: brief.value_hypothesis ?? '',
            tone_of_voice: tone,
            desired_next_step: desiredNextStep.trim(),
            channel,
          },
          links: {
            sdr_task_id: task.id,
            prospect_id: task.prospect_id,
            opportunity_id: (task as any).opportunity_id ?? null,
          },
        },
      });
      if (error) throw error;
      const out = (data?.output ?? data?.result ?? data) as ObjectionResult;
      if (!out?.response) throw new Error('Resposta vazia da skill.');
      setResult({
        response: out.response,
        follow_up_question: out.follow_up_question ?? '',
        recommended_next_step: out.recommended_next_step ?? '',
        confidence: Number(out.confidence ?? 0),
        skill_slug: data?.skill_slug,
        run_id: data?.run_id,
      });
    } catch (e: any) {
      toast.error(`Falha ao responder objeção: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!result) return;
    const parts = [
      result.response,
      result.follow_up_question ? `\n\nPergunta de follow-up: ${result.follow_up_question}` : '',
      result.recommended_next_step ? `\nPróximo passo: ${result.recommended_next_step}` : '',
    ].join('');
    await navigator.clipboard.writeText(parts);
    toast.success('Resposta copiada.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4" /> Responder objeção
          </DialogTitle>
          <DialogDescription>
            Motor consultivo — sem desconto automático, sem pressão, sem ataque ao concorrente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de objeção</Label>
              <Select value={objectionType} onValueChange={setObjectionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBJECTION_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as SDRCopilotChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Mensagem do cliente</Label>
              <Textarea
                rows={3}
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                placeholder="Cole aqui exatamente o que o cliente respondeu…"
              />
            </div>
            <div className="space-y-1">
              <Label>Tom</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Próximo passo desejado (opcional)</Label>
              <Textarea
                rows={1}
                value={desiredNextStep}
                onChange={(e) => setDesiredNextStep(e.target.value)}
                placeholder="Ex.: call de 15min esta semana"
              />
            </div>
          </div>

          {result && (
            <div className="space-y-2 border rounded p-3 bg-muted/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">confiança {result.confidence}</Badge>
                  {result.skill_slug && <Badge variant="outline">{result.skill_slug}</Badge>}
                </div>
                <Button size="sm" variant="ghost" onClick={copyAll}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
              </div>
              <div className="text-sm whitespace-pre-wrap">{result.response}</div>
              {result.follow_up_question && (
                <div className="text-sm border-t pt-2">
                  <span className="text-xs uppercase text-muted-foreground">Follow-up: </span>
                  {result.follow_up_question}
                </div>
              )}
              {result.recommended_next_step && (
                <div className="text-sm">
                  <span className="text-xs uppercase text-muted-foreground">Próximo passo: </span>
                  {result.recommended_next_step}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleRun} disabled={loading || !customerMessage.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {result ? 'Gerar novamente' : 'Gerar resposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
