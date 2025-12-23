import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Loader2, 
  Sparkles, 
  Check, 
  X, 
  Edit, 
  Zap,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  WorkflowRule, 
  TRIGGER_TYPE_LABELS, 
  ACTION_TYPE_LABELS 
} from '@/services/crm/workflow-rules';
import { 
  useCreateWorkflowRule, 
  useUpdateWorkflowRule, 
  useDeleteWorkflowRule,
  useToggleWorkflowRule 
} from '@/hooks/useWorkflowRules';
import { listPipelines, type Pipeline } from '@/services/crm/pipelines';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ParsedAutomationResult {
  action: 'create' | 'update' | 'delete' | 'list' | 'toggle' | 'clarify';
  rule_id?: string;
  rule_name?: string;
  workflow_rule?: Partial<WorkflowRule>;
  clarification_message?: string;
  confirmation_message: string;
}

interface ConversationalAutomationInputProps {
  existingRules: WorkflowRule[];
  onRuleCreated?: () => void;
  onRuleUpdated?: () => void;
  onRuleDeleted?: () => void;
}

const EXAMPLE_COMMANDS = [
  "Quando entrar em Negociação, criar follow-up em 2 dias",
  "Ao ganhar oportunidade, notificar o gerente",
  "Quando proposta for visualizada, mover para Proposta Enviada",
  "Criar atividade de ligação quando entrar em Qualificação",
];

export function ConversationalAutomationInput({ 
  existingRules, 
  onRuleCreated,
  onRuleUpdated,
  onRuleDeleted
}: ConversationalAutomationInputProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedAutomationResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createMutation = useCreateWorkflowRule();
  const updateMutation = useUpdateWorkflowRule();
  const deleteMutation = useDeleteWorkflowRule();
  const toggleMutation = useToggleWorkflowRule();

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    try {
      const pipelinesData = await listPipelines();
      setPipelines(pipelinesData);
    } catch (error) {
      console.error('Error loading pipelines:', error);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setParsedResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-parse-automation-rule', {
        body: {
          message: input,
          context: {
            pipelines: pipelines.map(p => ({
              id: p.id,
              name: p.name,
              stages: p.stages.map(s => ({ id: s.id, name: s.name }))
            })),
            users: [] // TODO: Add users context if needed
          },
          existingRules: existingRules.map(r => ({
            id: r.id,
            name: r.name,
            trigger_type: r.trigger_type,
            is_active: r.is_active
          }))
        }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      setParsedResult(data);
    } catch (error) {
      console.error('Error parsing automation command:', error);
      toast({
        title: "Erro ao processar",
        description: "Não foi possível interpretar o comando. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedResult) return;

    setIsLoading(true);

    try {
      switch (parsedResult.action) {
        case 'create':
          if (parsedResult.workflow_rule) {
            await createMutation.mutateAsync(parsedResult.workflow_rule);
            toast({
              title: "Regra criada",
              description: `A automação "${parsedResult.workflow_rule.name}" foi criada com sucesso.`
            });
            onRuleCreated?.();
          }
          break;

        case 'update':
          if (parsedResult.rule_id && parsedResult.workflow_rule) {
            await updateMutation.mutateAsync({ 
              id: parsedResult.rule_id, 
              rule: parsedResult.workflow_rule 
            });
            toast({
              title: "Regra atualizada",
              description: "A automação foi atualizada com sucesso."
            });
            onRuleUpdated?.();
          } else if (parsedResult.rule_name) {
            // Find rule by name
            const rule = existingRules.find(r => 
              r.name.toLowerCase().includes(parsedResult.rule_name!.toLowerCase())
            );
            if (rule && parsedResult.workflow_rule) {
              await updateMutation.mutateAsync({ 
                id: rule.id, 
                rule: parsedResult.workflow_rule 
              });
              toast({
                title: "Regra atualizada",
                description: `A automação "${rule.name}" foi atualizada.`
              });
              onRuleUpdated?.();
            }
          }
          break;

        case 'delete':
          if (parsedResult.rule_id) {
            await deleteMutation.mutateAsync(parsedResult.rule_id);
            toast({
              title: "Regra excluída",
              description: "A automação foi excluída com sucesso."
            });
            onRuleDeleted?.();
          } else if (parsedResult.rule_name) {
            const rule = existingRules.find(r => 
              r.name.toLowerCase().includes(parsedResult.rule_name!.toLowerCase())
            );
            if (rule) {
              await deleteMutation.mutateAsync(rule.id);
              toast({
                title: "Regra excluída",
                description: `A automação "${rule.name}" foi excluída.`
              });
              onRuleDeleted?.();
            }
          }
          break;

        case 'toggle':
          if (parsedResult.rule_id) {
            const rule = existingRules.find(r => r.id === parsedResult.rule_id);
            if (rule) {
              await toggleMutation.mutateAsync({ id: rule.id, isActive: !rule.is_active });
              toast({
                title: rule.is_active ? "Regra desativada" : "Regra ativada",
                description: `A automação "${rule.name}" foi ${rule.is_active ? 'desativada' : 'ativada'}.`
              });
              onRuleUpdated?.();
            }
          } else if (parsedResult.rule_name) {
            const rule = existingRules.find(r => 
              r.name.toLowerCase().includes(parsedResult.rule_name!.toLowerCase())
            );
            if (rule) {
              await toggleMutation.mutateAsync({ id: rule.id, isActive: !rule.is_active });
              toast({
                title: rule.is_active ? "Regra desativada" : "Regra ativada",
                description: `A automação "${rule.name}" foi ${rule.is_active ? 'desativada' : 'ativada'}.`
              });
              onRuleUpdated?.();
            }
          }
          break;

        case 'list':
          toast({
            title: "Regras existentes",
            description: existingRules.length > 0 
              ? `Você tem ${existingRules.length} regra(s) configurada(s).`
              : "Nenhuma regra configurada ainda."
          });
          break;
      }

      // Clear state after success
      setInput('');
      setParsedResult(null);
    } catch (error) {
      console.error('Error executing action:', error);
      toast({
        title: "Erro",
        description: "Não foi possível executar a ação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setParsedResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    textareaRef.current?.focus();
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Automação Inteligente</CardTitle>
                  <CardDescription className="text-sm">
                    Descreva o que você quer automatizar em linguagem natural
                  </CardDescription>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Input area */}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Quando entrar em Negociação, criar uma atividade de follow-up para 2 dias..."
                className="min-h-[80px] pr-12 resize-none"
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="absolute bottom-2 right-2"
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Example suggestions */}
            {!parsedResult && !isLoading && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Exemplos de comandos:
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_COMMANDS.map((example, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                      onClick={() => handleExampleClick(example)}
                    >
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {isLoading && !parsedResult && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando seu comando...
              </div>
            )}

            {/* Parsed result preview */}
            {parsedResult && (
              <Card className={cn(
                "border-2",
                parsedResult.action === 'clarify' 
                  ? "border-yellow-500/50 bg-yellow-500/5" 
                  : "border-primary/50 bg-primary/5"
              )}>
                <CardContent className="pt-4 space-y-3">
                  {parsedResult.action === 'clarify' ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-yellow-600">
                        Preciso de mais informações:
                      </p>
                      <p className="text-sm">{parsedResult.clarification_message}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          parsedResult.action === 'create' ? 'default' :
                          parsedResult.action === 'delete' ? 'destructive' :
                          'secondary'
                        }>
                          {parsedResult.action === 'create' && 'Criar'}
                          {parsedResult.action === 'update' && 'Atualizar'}
                          {parsedResult.action === 'delete' && 'Excluir'}
                          {parsedResult.action === 'toggle' && 'Alternar'}
                          {parsedResult.action === 'list' && 'Listar'}
                        </Badge>
                        <span className="text-sm font-medium">
                          {parsedResult.confirmation_message}
                        </span>
                      </div>

                      {parsedResult.workflow_rule && (
                        <div className="bg-background/50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <span className="font-medium">{parsedResult.workflow_rule.name}</span>
                          </div>
                          
                          {parsedResult.workflow_rule.trigger_type && (
                            <div className="text-muted-foreground">
                              <span className="font-medium">Gatilho:</span>{' '}
                              {TRIGGER_TYPE_LABELS[parsedResult.workflow_rule.trigger_type]}
                            </div>
                          )}

                          {parsedResult.workflow_rule.actions && parsedResult.workflow_rule.actions.length > 0 && (
                            <div className="text-muted-foreground">
                              <span className="font-medium">Ações:</span>{' '}
                              {parsedResult.workflow_rule.actions.map(a => 
                                ACTION_TYPE_LABELS[a.type] || a.type
                              ).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
                
                <CardFooter className="gap-2 pt-0">
                  {parsedResult.action !== 'clarify' && parsedResult.action !== 'list' && (
                    <Button 
                      size="sm" 
                      onClick={handleConfirm}
                      disabled={isLoading}
                      className="gap-1"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Confirmar
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleCancel}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    Cancelar
                  </Button>
                </CardFooter>
              </Card>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
