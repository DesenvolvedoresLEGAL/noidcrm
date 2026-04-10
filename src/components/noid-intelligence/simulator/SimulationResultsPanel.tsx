import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Clock, Cpu, Coins, Target, Wrench, MessageSquare, Shield } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  result: any;
}

export default function SimulationResultsPanel({ result }: Props) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">Rode uma simulação para ver os resultados aqui</p>
      </div>
    );
  }

  const { context, deliberation, tool_plan, output_preview, validation, execution_time_ms, total_tokens, estimated_cost } = result;

  return (
    <Tabs defaultValue="context" className="w-full">
      <TabsList className="grid grid-cols-6 w-full">
        <TabsTrigger value="context" className="text-xs">Contexto</TabsTrigger>
        <TabsTrigger value="deliberation" className="text-xs">Deliberação</TabsTrigger>
        <TabsTrigger value="tools" className="text-xs">Tools</TabsTrigger>
        <TabsTrigger value="output" className="text-xs">Output</TabsTrigger>
        <TabsTrigger value="validation" className="text-xs">Validação</TabsTrigger>
        <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
      </TabsList>

      {/* Context Tab */}
      <TabsContent value="context" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Contexto do Agente</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {context?.agent && (
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Agente:</span> {context.agent.name}</div>
                <div><span className="text-muted-foreground">Objetivo:</span> {context.agent.objective || '—'}</div>
                <div><span className="text-muted-foreground">Autonomia:</span> {context.agent.autonomy}</div>
                <div><span className="text-muted-foreground">Escopo:</span> {context.agent.scope?.join(', ') || '—'}</div>
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">Cenário de Entrada</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                {JSON.stringify(context?.scenario || {}, null, 2)}
              </pre>
            </div>
            {context?.memory_config && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium mb-1">Memória</p>
                <div className="flex gap-2">
                  {context.memory_config.short_term && <Badge variant="outline" className="text-xs">Curta</Badge>}
                  {context.memory_config.operational && <Badge variant="outline" className="text-xs">Operacional</Badge>}
                  {context.memory_config.learning && <Badge variant="outline" className="text-xs">Aprendizagem</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Deliberation Tab */}
      <TabsContent value="deliberation" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" /> Deliberação do Agente</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {deliberation?.error ? (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{deliberation.error}</div>
            ) : deliberation?.parse_error ? (
              <div>
                <p className="text-muted-foreground mb-2">Resposta não estruturada:</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">{deliberation.raw_response}</pre>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Objetivo Inferido</p>
                    <p className="text-sm font-medium mt-1">{deliberation.objective || '—'}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Ação Sugerida</p>
                    <p className="text-sm font-medium mt-1">{deliberation.suggested_action || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/50 rounded-md text-center">
                    <p className="text-xs text-muted-foreground">Confiança</p>
                    <p className="text-lg font-bold">{deliberation.confidence_score != null ? `${Math.round(deliberation.confidence_score * 100)}%` : '—'}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-md text-center">
                    <p className="text-xs text-muted-foreground">Risco</p>
                    <Badge variant="outline" className="mt-1">{deliberation.risk_level || '—'}</Badge>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-md text-center">
                    <p className="text-xs text-muted-foreground">Aprovação</p>
                    <p className="text-sm font-medium mt-1">{deliberation.requires_approval ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
                {deliberation.hypothesis && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Hipótese Principal</p>
                    <p className="text-sm mt-1">{deliberation.hypothesis}</p>
                  </div>
                )}
                {deliberation.reasoning && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Raciocínio</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{deliberation.reasoning}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tools Tab */}
      <TabsContent value="tools" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" /> Plano de Tools</CardTitle></CardHeader>
          <CardContent>
            {(!tool_plan || tool_plan.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhuma tool selecionada nesta simulação</p>
            ) : (
              <div className="space-y-3">
                {tool_plan.map((t: any, i: number) => (
                  <div key={i} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{t.tool_name || t.tool_key}</span>
                      <div className="flex gap-1">
                        {t.would_be_blocked && <Badge variant="destructive" className="text-xs">Bloqueada</Badge>}
                        {t.requires_approval && <Badge variant="outline" className="text-xs">Requer Aprovação</Badge>}
                        {t.risk_level && <Badge variant="outline" className="text-xs">{t.risk_level}</Badge>}
                      </div>
                    </div>
                    {t.simulated_payload && (
                      <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-24">
                        {JSON.stringify(t.simulated_payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Output Tab */}
      <TabsContent value="output" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Preview de Saída</CardTitle></CardHeader>
          <CardContent>
            {!output_preview || Object.keys(output_preview).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum output gerado</p>
            ) : output_preview.raw_content ? (
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap">{output_preview.raw_content}</pre>
            ) : (
              <div className="space-y-3">
                {output_preview.action_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Tipo:</span>
                    <Badge variant="outline">{output_preview.action_type}</Badge>
                  </div>
                )}
                {output_preview.subject && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Assunto</p>
                    <p className="text-sm font-medium mt-1">{output_preview.subject}</p>
                  </div>
                )}
                {output_preview.content && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Conteúdo</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{output_preview.content}</p>
                  </div>
                )}
                {output_preview.next_step && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">Próximo Passo</p>
                    <p className="text-sm mt-1">{output_preview.next_step}</p>
                  </div>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Ver JSON completo</summary>
                  <pre className="bg-muted p-3 rounded-md overflow-auto max-h-48 mt-2">
                    {JSON.stringify(output_preview, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Validation Tab */}
      <TabsContent value="validation" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Validação Assistida</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {validation && (
              <>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{Math.round(validation.score || 0)}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="flex-1">
                    <Progress value={validation.score || 0} className="h-3" />
                  </div>
                  <Badge className={
                    validation.overall_status === 'passed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    validation.overall_status === 'blocked' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }>
                    {validation.overall_status === 'passed' ? 'Aprovado' : validation.overall_status === 'blocked' ? 'Bloqueado' : 'Revisão Necessária'}
                  </Badge>
                </div>

                {/* Score breakdown */}
                {validation.readiness && (
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      { label: 'Config', score: validation.readiness.config_score, max: 20 },
                      { label: 'Coerência', score: validation.readiness.coherence_score, max: 25 },
                      { label: 'Segurança', score: validation.readiness.security_score, max: 25 },
                      { label: 'Qualidade', score: validation.readiness.quality_score, max: 20 },
                      { label: 'Completude', score: validation.readiness.completeness_score, max: 10 },
                    ].map(d => (
                      <div key={d.label} className="p-2 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{d.label}</p>
                        <p className="text-sm font-bold">{d.score}/{d.max}</p>
                      </div>
                    ))}
                  </div>
                )}

                {validation.blocking_issues?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive">Bloqueios</p>
                    {validation.blocking_issues.map((e: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-3 w-3" /> {e}</div>
                    ))}
                  </div>
                )}
                {validation.warnings?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Avisos</p>
                    {validation.warnings.map((w: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400"><AlertTriangle className="h-3 w-3" /> {w}</div>
                    ))}
                  </div>
                )}
                {validation.recommendations?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Recomendações</p>
                    {validation.recommendations.map((r: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400"><CheckCircle className="h-3 w-3" /> {r}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Timeline Tab */}
      <TabsContent value="timeline" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline Técnica</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted/50 rounded-md">
                <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{execution_time_ms ? `${(execution_time_ms / 1000).toFixed(1)}s` : '—'}</p>
                <p className="text-xs text-muted-foreground">Duração</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <Cpu className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{total_tokens || '—'}</p>
                <p className="text-xs text-muted-foreground">Tokens</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <Coins className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{estimated_cost ? `$${Number(estimated_cost).toFixed(4)}` : '—'}</p>
                <p className="text-xs text-muted-foreground">Custo Est.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
