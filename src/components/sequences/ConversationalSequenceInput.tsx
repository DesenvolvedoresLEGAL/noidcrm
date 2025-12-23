import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  Sparkles, 
  Loader2, 
  Mail, 
  MessageSquare, 
  CheckSquare, 
  Phone, 
  Clock,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { createSequence, deleteSequence, listSequences, updateSequence } from '@/services/supabase/sequences';
import { useToast } from '@/hooks/use-toast';

interface Step {
  id: string;
  type: 'email' | 'whatsapp' | 'task' | 'call' | 'wait';
  delay: number;
  content: {
    subject?: string;
    body?: string;
    message?: string;
    title?: string;
    description?: string;
  };
}

interface SequenceData {
  name: string;
  audience: string;
  objective: string;
  steps: Step[];
}

interface ParsedCommand {
  action: 'create' | 'update' | 'delete' | 'list' | 'duplicate';
  sequenceId?: string;
  sequenceData?: SequenceData;
  explanation: string;
  confidence: number;
}

interface ConversationalSequenceInputProps {
  onSequenceCreated: () => void;
  onSequenceDeleted: () => void;
}

export function ConversationalSequenceInput({ 
  onSequenceCreated, 
  onSequenceDeleted 
}: ConversationalSequenceInputProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exampleCommands = [
    'Criar cadência de 5 passos para leads que fizeram demo: email inicial, aguardar 2 dias, WhatsApp de follow-up, aguardar 3 dias, tarefa de ligação',
    'Criar sequência de onboarding com 3 emails espaçados de 1 semana',
    'Cadência de reengajamento: email, esperar 3 dias, WhatsApp, esperar 2 dias, ligação',
  ];

  const handleSubmit = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setParsedCommand(null);

    try {
      // Buscar cadências existentes para contexto
      const sequences = await listSequences();

      const { data, error: fnError } = await supabase.functions.invoke('ai-parse-sequence', {
        body: { 
          message: input,
          existingSequences: sequences.map(s => ({
            id: s.id,
            name: s.name,
            steps: s.steps
          }))
        }
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        if (data.suggestion) {
          setError(`${data.error}\n\n💡 ${data.suggestion}`);
        }
        return;
      }

      // Para ação de listar, mostrar resultado direto
      if (data.action === 'list') {
        toast({
          title: 'Cadências existentes',
          description: sequences.length > 0 
            ? sequences.map(s => `• ${s.name}`).join('\n')
            : 'Nenhuma cadência encontrada'
        });
        setInput('');
        return;
      }

      setParsedCommand(data);
    } catch (err) {
      console.error('Error parsing sequence command:', err);
      setError('Erro ao processar comando. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedCommand) return;

    setLoading(true);
    try {
      switch (parsedCommand.action) {
        case 'create':
          if (parsedCommand.sequenceData) {
            await createSequence({
              name: parsedCommand.sequenceData.name,
              description: parsedCommand.sequenceData.audience,
              trigger_type: parsedCommand.sequenceData.objective || 'manual',
              status: 'active',
              steps: { steps: parsedCommand.sequenceData.steps }
            });
            toast({
              title: 'Cadência criada!',
              description: `"${parsedCommand.sequenceData.name}" foi criada com ${parsedCommand.sequenceData.steps.length} passos.`
            });
            onSequenceCreated();
          }
          break;

        case 'update':
          if (parsedCommand.sequenceId && parsedCommand.sequenceData) {
            await updateSequence(parsedCommand.sequenceId, {
              name: parsedCommand.sequenceData.name,
              description: parsedCommand.sequenceData.audience,
              trigger_type: parsedCommand.sequenceData.objective,
              steps: parsedCommand.sequenceData.steps
            });
            toast({
              title: 'Cadência atualizada!',
              description: `"${parsedCommand.sequenceData.name}" foi atualizada.`
            });
            onSequenceCreated();
          }
          break;

        case 'delete':
          if (parsedCommand.sequenceId) {
            await deleteSequence(parsedCommand.sequenceId);
            toast({
              title: 'Cadência excluída!',
              description: 'A cadência foi removida com sucesso.'
            });
            onSequenceDeleted();
          }
          break;

        case 'duplicate':
          if (parsedCommand.sequenceId) {
            const sequences = await listSequences();
            const original = sequences.find(s => s.id === parsedCommand.sequenceId);
            if (original) {
              await createSequence({
                name: `${original.name} (cópia)`,
                description: original.description,
                trigger_type: original.trigger_type,
                status: 'draft',
                steps: original.steps
              });
              toast({
                title: 'Cadência duplicada!',
                description: `Cópia de "${original.name}" criada.`
              });
              onSequenceCreated();
            }
          }
          break;
      }

      setParsedCommand(null);
      setInput('');
    } catch (err) {
      console.error('Error executing sequence action:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao executar ação. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setParsedCommand(null);
    setError(null);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4 text-primary" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'task':
        return <CheckSquare className="h-4 w-4 text-accent" />;
      case 'call':
        return <Phone className="h-4 w-4 text-secondary" />;
      case 'wait':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStepLabel = (type: string) => {
    switch (type) {
      case 'email': return 'E-mail';
      case 'whatsapp': return 'WhatsApp';
      case 'task': return 'Tarefa';
      case 'call': return 'Ligação';
      case 'wait': return 'Aguardar';
      default: return type;
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Criar Cadência com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Descreva a cadência que deseja criar... Ex: 'Criar cadência de follow-up com 3 emails e 1 WhatsApp'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSubmit();
              }
            }}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !input.trim()}
            className="self-end"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Sugestões de exemplo */}
        {!parsedCommand && !error && (
          <div className="flex flex-wrap gap-2">
            {exampleCommands.map((cmd, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 text-xs max-w-full truncate"
                onClick={() => setInput(cmd)}
              >
                {cmd.slice(0, 60)}...
              </Badge>
            ))}
          </div>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {/* Preview da Cadência Interpretada */}
        {parsedCommand && parsedCommand.sequenceData && (
          <Card className="border-2 border-primary/30 bg-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {parsedCommand.action === 'create' ? '✨ Nova Cadência' : 
                     parsedCommand.action === 'update' ? '✏️ Atualizar Cadência' :
                     '📋 Cadência'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {parsedCommand.explanation}
                  </p>
                </div>
                <Badge variant="secondary">
                  {Math.round(parsedCommand.confidence * 100)}% confiança
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium">{parsedCommand.sequenceData.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Objetivo:</span>
                  <p className="font-medium">{parsedCommand.sequenceData.objective}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Audiência:</span>
                  <p className="font-medium">{parsedCommand.sequenceData.audience}</p>
                </div>
              </div>

              {/* Timeline de Passos */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Passos ({parsedCommand.sequenceData.steps.length}):
                </p>
                <div className="space-y-2">
                  {parsedCommand.sequenceData.steps.map((step, idx) => (
                    <div 
                      key={step.id || idx}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        {getStepIcon(step.type)}
                        <span className="font-medium text-sm">{getStepLabel(step.type)}</span>
                        {step.delay > 0 && (
                          <Badge variant="outline" className="text-xs">
                            +{step.delay}d
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {step.content?.subject || step.content?.message || step.content?.title || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirmar
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={loading}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview para Delete */}
        {parsedCommand && parsedCommand.action === 'delete' && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription>
              <p className="font-medium mb-2">Excluir cadência?</p>
              <p className="text-sm mb-3">{parsedCommand.explanation}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleConfirm} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Exclusão'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
