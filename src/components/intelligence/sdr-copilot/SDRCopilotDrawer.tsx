import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Copy, CheckCircle2, Trash2, Send, ClipboardList, RefreshCw, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { useGenerateSDRMessage, useUpdateSDRCopilotStatus } from '@/hooks/intelligence/useSDRCopilotTasks';
import { CHANNEL_LABEL, NEXT_ACTION_LABEL, STATUS_LABEL, type SDRCopilotChannel, type SDRCopilotTask } from '@/services/intelligence/sdrCopilot';
import { SmartCoverageTab } from '@/components/intelligence/smart-coverage/SmartCoverageTab';
import { ObjectionResponseModal } from './ObjectionResponseModal';

interface Props {
  task: SDRCopilotTask;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const CHANNELS: SDRCopilotChannel[] = ['whatsapp', 'email', 'linkedin', 'call'];

function formatMessage(channel: SDRCopilotChannel, msg: unknown): string {
  if (!msg) return '';
  if (typeof msg === 'string') return msg;
  if (channel === 'email') {
    const m = msg as { subject?: string; body?: string };
    return `Assunto: ${m.subject ?? ''}\n\n${m.body ?? ''}`;
  }
  if (channel === 'call') {
    const m = msg as { opening?: string; main_question?: string; objections?: { objection: string; response: string }[]; closing?: string };
    const lines = [
      `Abertura: ${m.opening ?? ''}`,
      `Pergunta: ${m.main_question ?? ''}`,
      '',
      ...(m.objections ?? []).map((o) => `Objeção: ${o.objection}\n→ ${o.response}`),
      '',
      `Fechamento: ${m.closing ?? ''}`,
    ];
    return lines.join('\n');
  }
  return JSON.stringify(msg, null, 2);
}

export function SDRCopilotDrawer({ task, open, onOpenChange }: Props) {
  const [channel, setChannel] = useState<SDRCopilotChannel>(task.preferred_channel ?? 'whatsapp');
  const [objectionOpen, setObjectionOpen] = useState(false);
  const gen = useGenerateSDRMessage();
  const upd = useUpdateSDRCopilotStatus();

  const cached = (task.suggested_messages as Record<string, unknown>)?.[channel];

  const handleGenerate = async (force = false) => {
    try {
      await gen.mutateAsync({ taskId: task.id, channel, force });
    } catch (e: any) {
      toast.error(`Falha ao gerar: ${e.message ?? e}`);
    }
  };

  const handleCopy = async () => {
    const msg = cached ?? '';
    const text = formatMessage(channel, msg);
    if (!text) {
      await handleGenerate();
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success(`${CHANNEL_LABEL[channel]} copiado.`);
  };

  const setStatus = async (status: SDRCopilotTask['status'], successMsg: string) => {
    try {
      await upd.mutateAsync({ taskId: task.id, status });
      toast.success(successMsg);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Falha');
    }
  };

  const brief = task.commercial_brief as any;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{brief?.company_name ?? 'Tarefa SDR'}</span>
            <Badge variant="secondary">{STATUS_LABEL[task.status]}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Resumo */}
          <Card>
            <CardContent className="p-4 text-sm space-y-1">
              <div><span className="text-muted-foreground">Prioridade:</span> <strong>{task.priority_score}</strong></div>
              <div><span className="text-muted-foreground">Canal:</span> {task.preferred_channel ? CHANNEL_LABEL[task.preferred_channel] : '—'}</div>
              <div><span className="text-muted-foreground">Próxima ação:</span> {task.next_best_action ? NEXT_ACTION_LABEL[task.next_best_action] : '—'}</div>
              {task.reason && <div className="text-xs text-muted-foreground pt-1">{task.reason}</div>}
            </CardContent>
          </Card>

          {/* Smart Coverage */}
          {task.prospect_id && <SmartCoverageTab prospectId={task.prospect_id} />}

          {/* Brief */}
          {brief?.pain || brief?.value_hypothesis ? (
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Brief comercial</div>
                {brief?.pain && <div><strong>Dor:</strong> {String(brief.pain)}</div>}
                {brief?.value_hypothesis && <div><strong>Hipótese:</strong> {String(brief.value_hypothesis)}</div>}
                {task.cta && <div><strong>CTA:</strong> {task.cta}</div>}
              </CardContent>
            </Card>
          ) : null}

          {/* Objeções */}
          {Array.isArray(task.objections) && task.objections.length > 0 && (
            <Card>
              <CardContent className="p-4 text-sm space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Objeções previstas</div>
                <ul className="list-disc pl-5">
                  {(task.objections as any[]).map((o, i) => (
                    <li key={i}>{typeof o === 'string' ? o : (o?.objection ?? JSON.stringify(o))}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Mensagem por canal */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Tabs value={channel} onValueChange={(v) => setChannel(v as SDRCopilotChannel)}>
                <TabsList>
                  {CHANNELS.map((c) => (
                    <TabsTrigger key={c} value={c}>{CHANNEL_LABEL[c]}</TabsTrigger>
                  ))}
                </TabsList>
                {CHANNELS.map((c) => (
                  <TabsContent key={c} value={c} className="space-y-2">
                    <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap min-h-[120px]">
                      {gen.isPending && c === channel
                        ? 'Gerando…'
                        : formatMessage(c, (task.suggested_messages as Record<string, unknown>)?.[c]) || '— Mensagem ainda não gerada.'}
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleGenerate(false)} disabled={gen.isPending}>
                        {gen.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                        Gerar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleGenerate(true)} disabled={gen.isPending}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regerar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleCopy}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copiar {CHANNEL_LABEL[c]}
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pb-6">
            <Button variant="default" onClick={() => setStatus('activity_created', 'Atividade criada manualmente no CRM.')}>
              <ClipboardList className="h-4 w-4 mr-1" /> Criar atividade
            </Button>
            <Button variant="secondary" onClick={() => setStatus('promoted_to_crm', 'Marcada como promovida ao CRM.')}>
              Promover ao CRM
            </Button>
            <Button variant="outline" onClick={() => setStatus('completed', 'Tarefa concluída.')}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como feito
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setStatus('dismissed', 'Tarefa descartada.')}>
              <Trash2 className="h-4 w-4 mr-1" /> Descartar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
