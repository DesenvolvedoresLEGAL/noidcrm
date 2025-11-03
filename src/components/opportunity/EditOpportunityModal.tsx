import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Pipeline } from '@/services/crm/types';
import { Loader2 } from 'lucide-react';

const editOpportunitySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  pipeline_id: z.string().min(1, 'Funil é obrigatório'),
  stage_id: z.string().min(1, 'Etapa é obrigatória'),
  valor_previsto: z.coerce.number().min(0, 'Valor deve ser positivo').optional(),
  close_date_prevista: z.string().optional(),
  prob: z.number().min(0).max(1).optional(),
  temperatura: z.enum(['cold', 'warm', 'hot', 'burning']).optional(),
  origem: z.string().optional(),
  fonte: z.string().optional(),
  produto: z.string().optional(),
});

type EditOpportunityFormData = z.infer<typeof editOpportunitySchema>;

interface EditOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: any;
  pipelines: Pipeline[];
  onSave: (id: string, data: any) => Promise<void>;
}

export function EditOpportunityModal({
  open,
  onOpenChange,
  opportunity,
  pipelines,
  onSave,
}: EditOpportunityModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [probability, setProbability] = useState((opportunity?.prob || 0.5) * 100);

  const form = useForm<EditOpportunityFormData>({
    resolver: zodResolver(editOpportunitySchema),
    defaultValues: {
      title: opportunity?.title || opportunity?.account_name || '',
      pipeline_id: opportunity?.pipeline_id || '',
      stage_id: opportunity?.stage_id || '',
      valor_previsto: opportunity?.valor_previsto || 0,
      close_date_prevista: opportunity?.close_date_prevista
        ? new Date(opportunity.close_date_prevista).toISOString().split('T')[0]
        : '',
      prob: (opportunity?.prob || 0.5),
      temperatura: opportunity?.temperatura || opportunity?.temperature || 'warm',
      origem: opportunity?.origem || '',
      fonte: opportunity?.fonte || '',
      produto: opportunity?.produto || '',
    },
  });

  const selectedPipelineId = form.watch('pipeline_id');
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  const onSubmit = async (data: EditOpportunityFormData) => {
    setIsSubmitting(true);
    try {
      await onSave(opportunity.id, {
        ...data,
        prob: data.prob,
      });
      toast({
        title: 'Sucesso',
        description: 'Oportunidade atualizada com sucesso',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating opportunity:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar oportunidade',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Oportunidade</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Título */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da oportunidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ID (somente leitura) */}
              <FormItem className="col-span-2">
                <FormLabel>ID da Oportunidade</FormLabel>
                <Input value={opportunity?.id || ''} disabled className="bg-muted" />
              </FormItem>

              {/* Funil */}
              <FormField
                control={form.control}
                name="pipeline_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funil *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o funil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Etapa */}
              <FormField
                control={form.control}
                name="stage_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etapa *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!selectedPipeline}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a etapa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedPipeline?.stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Origem */}
              <FormField
                control={form.control}
                name="origem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="evento">Evento</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fonte */}
              <FormField
                control={form.control}
                name="fonte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonte</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Google Ads, LinkedIn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor P&S */}
              <FormField
                control={form.control}
                name="valor_previsto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de P&S (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Previsão de Fechamento */}
              <FormField
                control={form.control}
                name="close_date_prevista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previsão de Fechamento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Produto */}
              <FormField
                control={form.control}
                name="produto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do produto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Temperatura */}
              <FormField
                control={form.control}
                name="temperatura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperatura</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a temperatura" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cold">Frio (Cold)</SelectItem>
                        <SelectItem value="warm">Morno (Warm)</SelectItem>
                        <SelectItem value="hot">Quente (Hot)</SelectItem>
                        <SelectItem value="burning">Ardente (Burning)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Probabilidade */}
              <FormField
                control={form.control}
                name="prob"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Probabilidade: {Math.round((field.value || 0.5) * 100)}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[(field.value || 0.5) * 100]}
                        onValueChange={(vals) => {
                          field.onChange(vals[0] / 100);
                          setProbability(vals[0]);
                        }}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
