import { useState, useEffect } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { Pipeline } from '@/services/crm/types';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDateOnly, formatDateBR } from '@/lib/dateUtils';
import { AccountCombobox } from '@/components/opportunity/AccountCombobox';
import { ContactCombobox } from '@/components/opportunity/ContactCombobox';
import { TagsMultiSelect } from '@/components/opportunity/TagsMultiSelect';
import { OriginSelect } from '@/components/opportunity/OriginSelect';
import { getOpportunityTags, setOpportunityTags } from '@/hooks/useOrganizationTags';
import { useOpportunityQualificationScore } from '@/hooks/useOpportunityQualificationScore';
import { QualificationGateModal } from '@/components/opportunity/qualification/QualificationGateModal';

const editOpportunitySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  pipeline_id: z.string().min(1, 'Funil é obrigatório'),
  stage_id: z.string().min(1, 'Etapa é obrigatória'),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  owner_user_id: z.string().optional(),
  close_date_prevista: z.date().optional(),
  prob: z.number().int().min(0).max(100).optional(),
  temperatura: z.enum(['cold', 'warm', 'hot', 'burning']).optional(),
  origem: z.string().optional(),
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
  const { users } = useOrganizationUsers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [accountName, setAccountName] = useState('');

  const form = useForm<EditOpportunityFormData>({
    resolver: zodResolver(editOpportunitySchema),
    defaultValues: {
      title: opportunity?.title || '',
      pipeline_id: opportunity?.pipeline_id || '',
      stage_id: opportunity?.stage_id || '',
      account_id: opportunity?.account_id || '',
      contact_id: opportunity?.contact_id || '',
      owner_user_id: opportunity?.owner_user_id || '',
      close_date_prevista: opportunity?.close_date_prevista
        ? parseDateOnly(opportunity.close_date_prevista)
        : undefined,
      prob: opportunity?.prob || 50,
      temperatura: opportunity?.temperatura || opportunity?.temperature || 'warm',
      origem: opportunity?.origem || '',
    },
  });

  // Load opportunity tags
  useEffect(() => {
    if (opportunity?.id) {
      getOpportunityTags(opportunity.id).then(setSelectedTags);
    }
  }, [opportunity?.id]);

  // Set account name from opportunity data
  useEffect(() => {
    if (opportunity?.accounts) {
      setAccountName(opportunity.accounts.nome_fantasia || opportunity.accounts.razao_social || '');
    }
  }, [opportunity]);

  const selectedPipelineId = form.watch('pipeline_id');
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const watchedAccountId = form.watch('account_id');

  const onSubmit = async (data: EditOpportunityFormData) => {
    setIsSubmitting(true);
    try {
      // Convert Date to ISO UTC timestamp
      let dateString = null;
      if (data.close_date_prevista) {
        const date = data.close_date_prevista;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}T12:00:00Z`;
      }
      
      const submitData = {
        ...data,
        close_date_prevista: dateString,
        // Convert empty strings to null
        account_id: data.account_id || null,
        contact_id: data.contact_id || null,
        owner_user_id: data.owner_user_id || null,
        origem: data.origem || null,
      };
      
      await onSave(opportunity.id, submitData);
      
      // Save tags
      await setOpportunityTags(opportunity.id, selectedTags);
      
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
      <DialogContent className="w-full h-[100dvh] max-w-full md:max-w-2xl md:h-auto md:max-h-[90vh] rounded-none md:rounded-lg overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle>Editar Oportunidade</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Conta/Empresa */}
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <AccountCombobox
                        value={field.value || ''}
                        onChange={(accountId, name) => {
                          field.onChange(accountId);
                          setAccountName(name);
                          form.setValue('contact_id', ''); // Reset contact
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contato */}
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato</FormLabel>
                    <FormControl>
                      <ContactCombobox
                        value={field.value || ''}
                        onChange={field.onChange}
                        accountId={watchedAccountId}
                        disabled={!watchedAccountId}
                        placeholder={!watchedAccountId ? "Selecione uma empresa primeiro" : "Selecione o contato..."}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vendedor/Owner */}
              <FormField
                control={form.control}
                name="owner_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendedor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o vendedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
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
                    <FormControl>
                      <OriginSelect
                        value={field.value || ''}
                        onChange={field.onChange}
                      />
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? formatDateBR(field.value) : <span>Selecione uma data</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
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
                        <SelectItem value="cold">🥶 Frio</SelectItem>
                        <SelectItem value="warm">😐 Morno</SelectItem>
                        <SelectItem value="hot">🔥 Quente</SelectItem>
                        <SelectItem value="burning">💥 Ardente</SelectItem>
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
                    <FormLabel>Probabilidade: {field.value || 50}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[field.value || 50]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags */}
              <div className="col-span-2 space-y-2">
                <FormLabel>Tags</FormLabel>
                <TagsMultiSelect
                  value={selectedTags}
                  onChange={setSelectedTags}
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
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
