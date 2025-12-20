import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { CreateTicketData, RequestType, Urgency } from '@/hooks/useSupportTickets';

const ticketSchema = z.object({
  requestType: z.enum(['bug', 'question', 'improvement', 'billing', 'other']),
  affectedModule: z.string().optional(),
  subject: z.string().min(5, 'Assunto deve ter pelo menos 5 caracteres').max(255),
  description: z.string().min(20, 'Descrição deve ter pelo menos 20 caracteres').max(5000),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface CreateTicketFormProps {
  onSubmit: (data: CreateTicketData) => Promise<void>;
  isSubmitting: boolean;
  defaultType?: RequestType;
}

const requestTypes = [
  { value: 'bug', label: '🐛 Bug / Erro' },
  { value: 'question', label: '❓ Dúvida' },
  { value: 'improvement', label: '💡 Sugestão de melhoria' },
  { value: 'billing', label: '💳 Financeiro / Cobrança' },
  { value: 'other', label: '📋 Outro' },
];

const modules = [
  { value: 'pipeline', label: 'Pipeline de Vendas' },
  { value: 'forecast', label: 'Forecast' },
  { value: 'proposals', label: 'Propostas' },
  { value: 'scoring', label: 'Scoring de Leads' },
  { value: 'reports', label: 'Relatórios' },
  { value: 'intelligence', label: 'Inteligência (IA)' },
  { value: 'activities', label: 'Atividades' },
  { value: 'accounts', label: 'Contas e Contatos' },
  { value: 'roleplay', label: 'Roleplay' },
  { value: 'settings', label: 'Configurações' },
  { value: 'billing', label: 'Faturamento e Planos' },
  { value: 'authentication', label: 'Login e Acesso' },
  { value: 'other', label: 'Outro' },
];

const urgencies = [
  { value: 'low', label: 'Baixa', description: 'Não impacta o trabalho diário', sla: '72h' },
  { value: 'medium', label: 'Média', description: 'Impacto moderado, há alternativas', sla: '48h' },
  { value: 'high', label: 'Alta', description: 'Impacto significativo no trabalho', sla: '24h' },
  { value: 'critical', label: 'Crítica', description: 'Bloqueio total, sem alternativas', sla: '4h' },
];

export function CreateTicketForm({ onSubmit, isSubmitting, defaultType }: CreateTicketFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      requestType: defaultType || 'question',
      urgency: 'medium',
    },
  });

  const selectedUrgency = watch('urgency');

  const handleFormSubmit = async (data: TicketFormData) => {
    await onSubmit({
      requestType: data.requestType as RequestType,
      affectedModule: data.affectedModule,
      subject: data.subject,
      description: data.description,
      urgency: data.urgency as Urgency,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Request Type */}
      <div className="space-y-2">
        <Label htmlFor="requestType">Tipo de solicitação *</Label>
        <Select
          defaultValue={defaultType || 'question'}
          onValueChange={(value) => setValue('requestType', value as RequestType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {requestTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.requestType && (
          <p className="text-sm text-destructive">{errors.requestType.message}</p>
        )}
      </div>

      {/* Affected Module */}
      <div className="space-y-2">
        <Label htmlFor="affectedModule">Módulo afetado</Label>
        <Select onValueChange={(value) => setValue('affectedModule', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o módulo (opcional)" />
          </SelectTrigger>
          <SelectContent>
            {modules.map((module) => (
              <SelectItem key={module.value} value={module.value}>
                {module.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject">Assunto *</Label>
        <Input
          id="subject"
          placeholder="Resumo do problema ou dúvida"
          {...register('subject')}
        />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Descrição detalhada *</Label>
        <Textarea
          id="description"
          placeholder="Descreva o problema ou dúvida com o máximo de detalhes possível. Inclua passos para reproduzir o problema, se aplicável."
          rows={6}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Urgency */}
      <div className="space-y-3">
        <Label>Urgência *</Label>
        <RadioGroup
          defaultValue="medium"
          onValueChange={(value) => setValue('urgency', value as Urgency)}
          className="grid grid-cols-2 gap-3"
        >
          {urgencies.map((urgency) => (
            <div key={urgency.value}>
              <RadioGroupItem
                value={urgency.value}
                id={urgency.value}
                className="peer sr-only"
              />
              <Label
                htmlFor={urgency.value}
                className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedUrgency === urgency.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="font-medium">{urgency.label}</span>
                <span className="text-xs text-muted-foreground">{urgency.description}</span>
                <span className="text-xs text-primary mt-1">SLA: {urgency.sla}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
        {errors.urgency && (
          <p className="text-sm text-destructive">{errors.urgency.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Enviar solicitação'
        )}
      </Button>
    </form>
  );
}
