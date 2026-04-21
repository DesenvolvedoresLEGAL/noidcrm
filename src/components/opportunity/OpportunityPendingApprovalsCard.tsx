import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Check, X, Pencil, Loader2, Mail, AlertTriangle, RefreshCcw, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { useApproveAction, useRejectAction } from '@/hooks/useAgentExecution';
import type { PendingApproval } from '@/hooks/useOpportunityApprovals';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface Props {
  approvals: PendingApproval[];
  highlightApprovalId?: string | null;
}

export function OpportunityPendingApprovalsCard({ approvals, highlightApprovalId }: Props) {
  const [editTarget, setEditTarget] = useState<PendingApproval | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingApproval | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [openBriefId, setOpenBriefId] = useState<string | null>(null);

  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  if (!approvals || approvals.length === 0) return null;

  const handleApprove = (a: PendingApproval) => {
    approveMutation.mutate({ queueId: a.id });
  };

  const openEdit = (a: PendingApproval) => {
    setEditTarget(a);
    setEditSubject(a.email?.subject || '');
    setEditBody(a.email?.body_html || a.email?.body_text || '');
  };

  const handleConfirmEdit = () => {
    if (!editTarget) return;
    approveMutation.mutate(
      {
        queueId: editTarget.id,
        edits: { edited_subject: editSubject, edited_body_html: editBody },
      },
      {
        onSuccess: () => setEditTarget(null),
      }
    );
  };

  const handleConfirmReject = () => {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) return; // obrigatório
    rejectMutation.mutate(
      { queueId: rejectTarget.id, reason: rejectionReason },
      {
        onSuccess: () => {
          setRejectTarget(null);
          setRejectionReason('');
        },
      }
    );
  };

  return (
    <>
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>E-mails do Agente aguardando sua aprovação</span>
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
              {approvals.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.map((a) => {
            const isHighlight = highlightApprovalId === a.id;
            const isFailed = a.status === 'send_failed';
            return (
              <Card
                key={a.id}
                className={`bg-background ${isHighlight ? 'ring-2 ring-amber-500' : ''} ${isFailed ? 'border-destructive/50' : ''}`}
                id={`approval-${a.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          {a.agent?.name || 'Email Agent'}
                        </Badge>
                        {a.run?.scenario_label && (
                          <Badge variant="secondary" className="text-xs">
                            {a.run.scenario_label}
                          </Badge>
                        )}
                        {isFailed && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Falha no envio
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(a.requested_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {a.email?.scheduled_send_at && (
                          <Badge variant="outline" className="text-xs gap-1 border-blue-400 text-blue-700">
                            📅 Agendado: {format(parseISO(a.email.scheduled_send_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </Badge>
                        )}
                      </div>
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {a.email?.subject || '(sem assunto)'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Para: {a.email?.recipient_name ? `${a.email.recipient_name} <${a.email.recipient_email}>` : a.email?.recipient_email}
                      </p>
                    </div>
                  </div>

                  {isFailed && (a.email?.send_failure_reason || a.rejection_reason) && (
                    <div className="text-xs bg-destructive/10 border border-destructive/30 rounded-md p-2 text-destructive">
                      <strong>Motivo da falha:</strong> {a.email?.send_failure_reason || a.rejection_reason}
                      {(a.email?.send_attempts ?? 0) > 1 && (
                        <span className="ml-2 opacity-80">({a.email?.send_attempts} tentativas)</span>
                      )}
                    </div>
                  )}

                  {(() => {
                    const warn = a.run?.validation_warnings_json || a.email?.validation_warnings_json;
                    if (!warn) return null;
                    const isMetric = warn.flag?.includes('metric');
                    const isHallu = warn.flag?.includes('hallucination');
                    return (
                      <div className="text-xs bg-amber-500/10 border border-amber-500/40 rounded-md p-2 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <strong>
                            {isHallu && isMetric && '⚠ Possível alucinação + métrica não verificável'}
                            {isHallu && !isMetric && '⚠ Possível alucinação detectada'}
                            {!isHallu && isMetric && '⚠ Métrica sem origem no contexto'}
                          </strong>
                          {warn.suspicious_terms && warn.suspicious_terms.length > 0 && (
                            <div>Termos não encontrados: <span className="font-mono">{warn.suspicious_terms.slice(0, 8).join(', ')}</span></div>
                          )}
                          {warn.unverifiable_metrics && warn.unverifiable_metrics.length > 0 && (
                            <div>Métricas suspeitas: <span className="font-mono">{warn.unverifiable_metrics.slice(0, 6).join(', ')}</span></div>
                          )}
                          <div className="opacity-70">Revise antes de aprovar — o agente pode ter inventado dados.</div>
                        </div>
                      </div>
                    );
                  })()}

                  {a.email && (
                    <div
                      className="text-sm prose prose-sm max-w-none border rounded-md p-3 bg-muted/30 max-h-[280px] overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(a.email.body_html || `<pre>${a.email.body_text || ''}</pre>`),
                      }}
                    />
                  )}

                  {a.run?.brief_signature && (
                    <div className="text-xs">
                      <button
                        type="button"
                        onClick={() => setOpenBriefId(openBriefId === a.id ? null : a.id)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        {openBriefId === a.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Brief usado pelo agente <span className="font-mono opacity-70">({a.run.brief_signature})</span>
                      </button>
                      {openBriefId === a.id && (
                        <pre className="mt-2 max-h-[260px] overflow-auto bg-muted/40 border rounded-md p-2 text-[11px] whitespace-pre-wrap">
{JSON.stringify(a.run.context_snapshot_json?.opportunity_brief ?? a.run.context_snapshot_json ?? { note: 'snapshot indisponível' }, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(a)}
                      disabled={approveMutation.isPending}
                      className="gap-1.5"
                      variant={isFailed ? 'default' : 'default'}
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isFailed ? (
                        <RefreshCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {isFailed ? 'Tentar reenviar' : 'Aprovar e enviar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      {isFailed ? 'Editar e reenviar' : 'Editar e aprovar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejectTarget(a)}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                      {isFailed ? 'Descartar' : 'Rejeitar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar e aprovar e-mail</DialogTitle>
            {editTarget?.email && (
              <p className="text-xs text-muted-foreground mt-1">
                Para:{' '}
                <span className="font-medium text-foreground">
                  {editTarget.email.recipient_name
                    ? `${editTarget.email.recipient_name} <${editTarget.email.recipient_email}>`
                    : editTarget.email.recipient_email}
                </span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-subject">Assunto</Label>
              <Input
                id="edit-subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Assunto do e-mail"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Corpo do e-mail</Label>
              <RichTextEditor
                value={editBody}
                onChange={setEditBody}
                placeholder="Edite o conteúdo do e-mail com formatação rica..."
                minHeight="320px"
              />
              <p className="text-[11px] text-muted-foreground">
                Use a barra de formatação para negrito, itálico, listas, links, alinhamento e cores. A prévia
                refletirá exatamente o que será enviado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEdit} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar e-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo da rejeição (obrigatório)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ex: Sugeriu data após vencimento da proposta, tom inadequado, já enviei proposta manualmente..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Este feedback será usado pelo agente para melhorar decisões futuras.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
