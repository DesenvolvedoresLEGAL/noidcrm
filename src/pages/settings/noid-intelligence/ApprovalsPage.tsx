import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, CheckCircle, XCircle, Mail, Eye,
  ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useApprovalQueue, useApproveAction, useRejectAction } from '@/hooks/useAgentExecution';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Label } from '@/components/ui/label';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnifiedApprovals, useDecideApproval } from '@/hooks/useGovernance';

export default function ApprovalsPage() {
  const { profile } = useCurrentUser();
  const orgId = profile?.organization_id;
  const { data: queue, isLoading } = useApprovalQueue(orgId);
  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();
  const navigate = useNavigate();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const handleApprove = (queueId: string) => {
    approveMutation.mutate({ queueId });
  };

  const handleApproveWithEdits = () => {
    if (!editModal) return;
    approveMutation.mutate({
      queueId: editModal.id,
      edits: {
        edited_subject: editSubject,
        edited_body_html: editBody,
        edited_body_text: editBody.replace(/<[^>]+>/g, '').trim(),
      },
    });
    setEditModal(null);
  };

  const handleReject = () => {
    if (!rejectModal) return;
    rejectMutation.mutate({ queueId: rejectModal, reason: rejectReason });
    setRejectModal(null);
    setRejectReason('');
  };

  const openEditModal = (item: any) => {
    const email = item.ai_email_messages;
    setEditSubject(email?.subject || '');
    setEditBody(email?.body_html || (email?.body_text ? `<p>${email.body_text.replace(/\n+/g, '</p><p>')}</p>` : ''));
    setEditModal(item);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Aprovações</h1>
        <p className="text-muted-foreground mt-1">
          Fila unificada de aprovações de agentes e operações sensíveis
        </p>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agentes (e-mails)</TabsTrigger>
          <TabsTrigger value="unified">Operações sensíveis</TabsTrigger>
        </TabsList>

        <TabsContent value="unified" className="space-y-3">
          <UnifiedApprovalsList />
        </TabsContent>

        <TabsContent value="agents" className="space-y-3">
      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : !queue || queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma ação pendente de aprovação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((item: any, i: number) => {
            const email = item.ai_email_messages;
            const run = item.ai_agent_execution_runs;
            const decision = run?.decision_json || {};
            const isExpanded = expandedId === item.id;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`border-yellow-200 dark:border-yellow-800/50 ${item.status === 'send_failed' ? 'border-destructive/50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm">
                              {(item.ai_agents as any)?.name || 'Agente'}
                            </span>
                            <Badge variant="outline" className="text-xs">{item.approval_type}</Badge>
                            {item.status === 'send_failed' && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> Falha no envio
                              </Badge>
                            )}
                            {decision.risk_level === 'high' && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> Alto risco
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Para: {email?.recipient_email} · Assunto: {email?.subject}
                          </p>
                          {item.status === 'send_failed' && (email?.send_failure_reason || item.rejection_reason) && (
                            <p className="text-xs text-destructive mt-1">
                              <strong>Motivo:</strong> {email?.send_failure_reason || item.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.requested_at).toLocaleDateString('pt-BR')}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        {/* Decision summary */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Cenário:</span>
                            <p className="font-medium">{run?.scenario_label || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Confiança:</span>
                            <p className="font-medium">{decision.confidence_score ? `${(decision.confidence_score * 100).toFixed(0)}%` : '-'}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Raciocínio:</span>
                            <p className="text-sm mt-1">{decision.reasoning_summary || '-'}</p>
                          </div>
                        </div>

                        {/* Email preview */}
                        {email?.body_html && (
                          <div className="border rounded-lg p-3 bg-muted/30">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Preview do email:</p>
                            <div className="text-sm prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }} />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/app/settings/noid-intelligence/runs/${item.run_id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> Ver detalhes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(item)}
                          >
                            Editar e aprovar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => { setRejectModal(item.id); setRejectReason(''); }}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(item.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {item.status === 'send_failed' ? 'Tentar reenviar' : 'Aprovar e enviar'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar antes de aprovar</DialogTitle>
            {editModal?.ai_email_messages?.recipient_email && (
              <p className="text-xs text-muted-foreground mt-1">
                Para:{' '}
                <span className="font-medium text-foreground">
                  {editModal.ai_email_messages.recipient_name
                    ? `${editModal.ai_email_messages.recipient_name} <${editModal.ai_email_messages.recipient_email}>`
                    : editModal.ai_email_messages.recipient_email}
                </span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
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
                Use a barra para negrito, itálico, listas, links, alinhamento e cores. A prévia reflete o
                que será enviado ao destinatário.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button onClick={handleApproveWithEdits} disabled={approveMutation.isPending}>
              Aprovar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectModal} onOpenChange={() => setRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar ação</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Motivo da rejeição (opcional)</label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Explique por que a ação foi rejeitada..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Unified Approvals (Sprint B/C) — humans + agents in one queue
// ============================================================
function UnifiedApprovalsList() {
  const { data, isLoading } = useUnifiedApprovals({ status: 'pending', limit: 100 });
  const decide = useDecideApproval();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (isLoading) return <div className="text-muted-foreground text-center py-12">Carregando...</div>;
  const rows = (data ?? []).filter((row) => row.source === 'approval_requests');
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma operação sensível pendente</p>
        </CardContent>
      </Card>
    );
  }

  const riskTone: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <>
      {rows.map((row) => (
        <Card key={row.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm font-semibold text-foreground">{row.action_key}</code>
                  <Badge className={`text-xs border-0 ${riskTone[row.risk_level] ?? ''}`}>
                    {row.risk_level.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{row.requester_type}</Badge>
                  {row.entity_type && (
                    <span className="text-xs text-muted-foreground">
                      {row.entity_type}{row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Solicitado em {new Date(row.requested_at).toLocaleString('pt-BR')}
                  {row.expires_at && ` · expira ${new Date(row.expires_at).toLocaleString('pt-BR')}`}
                </p>
                {row.payload && Object.keys(row.payload).length > 0 && (
                  <pre className="mt-2 text-[11px] bg-muted/40 rounded p-2 overflow-x-auto max-w-full">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { setRejecting(row.id); setReason(''); }}
                  disabled={decide.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
                <Button
                  size="sm"
                  onClick={() => decide.mutate({ approvalId: row.id, decision: 'approved' })}
                  disabled={decide.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!rejecting} onOpenChange={() => setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-sm">Motivo (opcional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => {
                if (!rejecting) return;
                decide.mutate(
                  { approvalId: rejecting, decision: 'rejected', reason },
                  { onSuccess: () => setRejecting(null) },
                );
              }}
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

