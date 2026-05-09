import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Clock, Mail, CheckCircle, XCircle, Zap, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRunDetails } from '@/hooks/useAgentExecution';
import { EXECUTION_STATUS_LABELS, EXECUTION_STATUS_COLORS, DELIVERY_STATUS_LABELS } from '@/types/ai-agents';
import type { ExecutionRunStatus } from '@/types/ai-agents';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useRunDetails(runId);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  if (error || !data?.run) return <div className="text-center py-12 text-muted-foreground">Run não encontrada</div>;

  const { run, actions, emails, deliveryEvents, impacts } = data;
  const decision = (run.decision_json || {}) as Record<string, any>;
  const context = (run.context_snapshot_json || {}) as Record<string, any>;
  const status = run.execution_status as ExecutionRunStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Run: {(run as any).ai_agents?.name || 'Agente'}
            <Badge className={EXECUTION_STATUS_COLORS[status]}>
              {EXECUTION_STATUS_LABELS[status]}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Versão {(run as any).ai_agent_versions?.version_number} · {run.scenario_label || run.entity_type} · {new Date(run.created_at).toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Timeline: Created / Approved / Sent — separa claramente cada momento */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Linha do tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Criado</p>
              <p className="font-medium mt-1">{run.created_at ? new Date(run.created_at).toLocaleString('pt-BR') : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Aprovado</p>
              <p className="font-medium mt-1">
                {run.approval_status === 'approved' && run.completed_at
                  ? new Date(run.completed_at).toLocaleString('pt-BR')
                  : <span className="text-muted-foreground">—</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Enviado</p>
              <p className="font-medium mt-1">
                {emails.find((e: any) => e.sent_at)
                  ? new Date(emails.find((e: any) => e.sent_at).sent_at).toLocaleString('pt-BR')
                  : <span className="text-muted-foreground">—</span>}
              </p>
            </div>
          </div>
          {decision.forced_to_draft === true && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                ⚠ Workflow forçou rascunho — a IA havia recomendado AGUARDAR
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-400">
                Decisão original da IA: <strong>should_act = {String(decision.original_should_act)}</strong>.
                {decision.original_reasoning_summary && (
                  <> Razão: {decision.original_reasoning_summary}</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Modo</p>
          <p className="font-medium text-sm">{run.execution_mode}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Confiança</p>
          <p className="font-medium text-sm">{decision.confidence_score ? `${(decision.confidence_score * 100).toFixed(0)}%` : '-'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Risco</p>
          <p className="font-medium text-sm">{decision.risk_level || '-'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Duração</p>
          <p className="font-medium text-sm">{run.execution_time_ms ? `${run.execution_time_ms}ms` : '-'}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="decision">
        <TabsList>
          <TabsTrigger value="decision">Deliberação</TabsTrigger>
          <TabsTrigger value="context">Contexto</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="actions">Ações</TabsTrigger>
          <TabsTrigger value="delivery">Entrega</TabsTrigger>
          <TabsTrigger value="impact">Impacto</TabsTrigger>
        </TabsList>

        <TabsContent value="decision" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Decisão do agente</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Ação:</span> <span className="font-medium">{decision.action_type || '-'}</span></div>
                <div><span className="text-muted-foreground">Objetivo:</span> <span className="font-medium">{decision.primary_objective || '-'}</span></div>
              </div>
              <div><span className="text-muted-foreground">Raciocínio:</span><p className="mt-1">{decision.reasoning_summary || '-'}</p></div>
              <div><span className="text-muted-foreground">Tool Plan:</span>
                <pre className="mt-1 bg-muted/50 rounded p-2 text-xs overflow-auto">{JSON.stringify(run.tool_plan_json, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contexto montado</CardTitle></CardHeader>
            <CardContent>
              <pre className="bg-muted/50 rounded p-3 text-xs overflow-auto max-h-96">{JSON.stringify(context, null, 2)}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          {emails.map((email: any) => (
            <Card key={email.id} className="mb-3">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {email.subject}
                  <Badge variant="outline" className="text-xs">{email.send_status}</Badge>
                  {email.was_human_edited && <Badge variant="secondary" className="text-xs">Editado</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">Para: {email.recipient_email}</p>
              </CardHeader>
              <CardContent>
                {email.body_html ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert border rounded p-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{email.body_text}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {emails.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum email gerado</p>}
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <div className="space-y-2">
            {actions.map((action: any) => (
              <Card key={action.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{action.tool_key}</span>
                    <span className="text-xs text-muted-foreground ml-2">{action.action_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{action.action_status}</Badge>
                    {action.provider_reference && <span className="text-xs text-muted-foreground">ref: {action.provider_reference}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {actions.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma ação registrada</p>}
          </div>
        </TabsContent>

        <TabsContent value="delivery" className="mt-4">
          <div className="space-y-2">
            {deliveryEvents.map((evt: any) => (
              <Card key={evt.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {evt.event_type === 'opened' ? <Eye className="h-4 w-4 text-blue-500" /> :
                     evt.event_type === 'replied' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                     evt.event_type === 'bounced' ? <XCircle className="h-4 w-4 text-red-500" /> :
                     <Clock className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-medium text-sm">{DELIVERY_STATUS_LABELS[evt.event_type as keyof typeof DELIVERY_STATUS_LABELS] || evt.event_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(evt.event_at).toLocaleString('pt-BR')}</span>
                </CardContent>
              </Card>
            ))}
            {deliveryEvents.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum evento de entrega</p>}
          </div>
        </TabsContent>

        <TabsContent value="impact" className="mt-4">
          <div className="space-y-2">
            {impacts.map((imp: any) => (
              <Card key={imp.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{imp.impact_type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(imp.observed_at).toLocaleString('pt-BR')}</span>
                </CardContent>
              </Card>
            ))}
            {impacts.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum impacto registrado</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
