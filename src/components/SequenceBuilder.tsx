import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Mail, Clock, Phone, CheckSquare, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Step {
  id: string;
  type: 'email' | 'whatsapp' | 'task' | 'call' | 'wait';
  delay: number;
  content: any;
}

interface SequenceBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSequence: (data: any) => Promise<void>;
}

export function SequenceBuilder({
  open,
  onOpenChange,
  onCreateSequence,
}: SequenceBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Passo 1: Informações Básicas
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('');
  const [objective, setObjective] = useState('');
  
  // Passo 2: Construtor de Passos
  const [steps, setSteps] = useState<Step[]>([]);
  const [editingStep, setEditingStep] = useState<Step | null>(null);

  const stepTypes = [
    { value: 'email', label: 'E-mail', icon: Mail, color: 'text-primary' },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-600' },
    { value: 'task', label: 'Tarefa Manual', icon: CheckSquare, color: 'text-accent' },
    { value: 'call', label: 'Ligação', icon: Phone, color: 'text-secondary' },
    { value: 'wait', label: 'Aguardar', icon: Clock, color: 'text-muted-foreground' },
  ];

  const objectives = [
    'Qualificação de Leads',
    'Follow-up Pós-Demo',
    'Educação e Engajamento',
    'Reengajamento',
    'Nutrição de Leads',
    'Conversão',
  ];

  const addStep = (type: Step['type']) => {
    const newStep: Step = {
      id: `step-${Date.now()}`,
      type,
      delay: steps.length > 0 ? 1 : 0,
      content: {},
    };
    setEditingStep(newStep);
  };

  const saveStep = () => {
    if (!editingStep) return;
    
    const existingIndex = steps.findIndex(s => s.id === editingStep.id);
    if (existingIndex >= 0) {
      const updated = [...steps];
      updated[existingIndex] = editingStep;
      setSteps(updated);
    } else {
      setSteps([...steps, editingStep]);
    }
    setEditingStep(null);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleSubmit = async () => {
    if (!name || !audience || !objective) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (steps.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos um passo à cadência',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await onCreateSequence({
        name,
        audience,
        objective,
        steps: { steps },
      });

      toast({
        title: 'Sucesso',
        description: 'Cadência criada com sucesso!',
      });

      // Reset
      setName('');
      setAudience('');
      setObjective('');
      setSteps([]);
      setCurrentStep(1);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar cadência',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (type: Step['type']) => {
    const stepType = stepTypes.find(t => t.value === type);
    const Icon = stepType?.icon || Clock;
    return <Icon className={`h-4 w-4 ${stepType?.color || 'text-muted-foreground'}`} />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cadência de Automação</DialogTitle>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step <= currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Passo 1: Informações Básicas */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Informações Básicas</h3>
              
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome da Cadência <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Follow-up Pós-Demo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">
                  Audiência/Segmento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex: Leads que realizaram demo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective">
                  Objetivo <span className="text-destructive">*</span>
                </Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger id="objective">
                    <SelectValue placeholder="Selecione o objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {objectives.map((obj) => (
                      <SelectItem key={obj} value={obj}>
                        {obj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Passo 2: Construtor de Passos */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Construtor de Passos</h3>
                <div className="flex gap-2">
                  {stepTypes.slice(0, 4).map((type) => {
                    const Icon = type.icon;
                    return (
                      <Button
                        key={type.value}
                        size="sm"
                        variant="outline"
                        onClick={() => addStep(type.value as Step['type'])}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {type.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Passos */}
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <Card key={step.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            {getStepIcon(step.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {stepTypes.find(t => t.value === step.type)?.label}
                              </span>
                              {step.delay > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{step.delay}d
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {step.content.subject || step.content.message || step.content.title || 'Aguardar...'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingStep(step)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeStep(step.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {steps.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <p>Nenhum passo adicionado ainda.</p>
                      <p className="text-sm mt-1">Clique nos botões acima para adicionar passos à sua cadência.</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Editor de Passo */}
              {editingStep && (
                <Card className="border-primary">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-semibold">
                      Editar: {stepTypes.find(t => t.value === editingStep.type)?.label}
                    </h4>

                    {editingStep.type === 'wait' && (
                      <div className="space-y-2">
                        <Label>Dias de espera</Label>
                        <Input
                          type="number"
                          value={editingStep.delay}
                          onChange={(e) =>
                            setEditingStep({ ...editingStep, delay: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    )}

                    {editingStep.type === 'email' && (
                      <>
                        <div className="space-y-2">
                          <Label>Assunto</Label>
                          <Input
                            value={editingStep.content.subject || ''}
                            onChange={(e) =>
                              setEditingStep({
                                ...editingStep,
                                content: { ...editingStep.content, subject: e.target.value },
                              })
                            }
                            placeholder="Assunto do e-mail"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Corpo do e-mail</Label>
                          <Textarea
                            value={editingStep.content.body || ''}
                            onChange={(e) =>
                              setEditingStep({
                                ...editingStep,
                                content: { ...editingStep.content, body: e.target.value },
                              })
                            }
                            placeholder="Conteúdo do e-mail..."
                            rows={4}
                          />
                        </div>
                      </>
                    )}

                    {editingStep.type === 'whatsapp' && (
                      <div className="space-y-2">
                        <Label>Mensagem</Label>
                        <Textarea
                          value={editingStep.content.message || ''}
                          onChange={(e) =>
                            setEditingStep({
                              ...editingStep,
                              content: { ...editingStep.content, message: e.target.value },
                            })
                          }
                          placeholder="Mensagem do WhatsApp..."
                          rows={3}
                        />
                      </div>
                    )}

                    {(editingStep.type === 'task' || editingStep.type === 'call') && (
                      <>
                        <div className="space-y-2">
                          <Label>Título</Label>
                          <Input
                            value={editingStep.content.title || ''}
                            onChange={(e) =>
                              setEditingStep({
                                ...editingStep,
                                content: { ...editingStep.content, title: e.target.value },
                              })
                            }
                            placeholder="Título da tarefa"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Textarea
                            value={editingStep.content.description || ''}
                            onChange={(e) =>
                              setEditingStep({
                                ...editingStep,
                                content: { ...editingStep.content, description: e.target.value },
                              })
                            }
                            placeholder="Descrição da tarefa..."
                            rows={3}
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={saveStep} size="sm">
                        Salvar Passo
                      </Button>
                      <Button
                        onClick={() => setEditingStep(null)}
                        size="sm"
                        variant="outline"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Passo 3: Revisão */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Revisão e Ativação</h3>
              
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Audiência</Label>
                    <p className="font-medium">{audience}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Objetivo</Label>
                    <p className="font-medium">{objective}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total de Passos</Label>
                    <p className="font-medium">{steps.length}</p>
                  </div>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground">
                Ao ativar, esta cadência começará a enviar mensagens automaticamente para os contatos que correspondem à audiência definida.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <div className="flex items-center justify-between w-full">
            <div>
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {currentStep < 3 ? (
                <Button onClick={() => setCurrentStep(currentStep + 1)}>
                  Próximo
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Criando...' : 'Ativar Cadência'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
