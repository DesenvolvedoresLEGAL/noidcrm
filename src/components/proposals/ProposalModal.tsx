import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createProposal, updateProposal, generateProposalPDF } from '@/services/supabase/proposals';
import { searchOpportunitiesForProposalPicker } from '@/services/supabase/opportunities';
import { proposalKeys } from '@/lib/query-keys';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useState } from 'react';


const proposalSchema = z.object({
  opportunity_id: z.string().uuid('Selecione uma oportunidade'),
  title: z.string().min(1, 'Título é obrigatório'),
  client_name: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal('')),
  value: z.string().optional(),
  expires_at: z.string().optional(),
  content: z.object({
    description: z.string().optional(),
    terms: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface ProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: any;
}

export function ProposalModal({ open, onOpenChange, proposal }: ProposalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!proposal;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Server-side opportunity search (50 max, open only, debounced)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const includeId: string | undefined = proposal?.opportunity_id || undefined;

  const { data: opportunities = [], isFetching: oppsFetching } = useQuery({
    queryKey: ['opportunities-picker', { q: debouncedSearch, includeId }],
    queryFn: () =>
      searchOpportunitiesForProposalPicker({
        q: debouncedSearch,
        limit: 50,
        includeId,
      }),
    enabled: open,
    staleTime: 30_000,
  });


  const { register, handleSubmit, control, formState: { errors }, watch } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      opportunity_id: proposal?.opportunity_id || '',
      title: proposal?.title || '',
      client_name: proposal?.client_name || '',
      client_email: proposal?.client_email || '',
      value: proposal?.value?.toString() || '',
      expires_at: proposal?.expires_at ? new Date(proposal.expires_at).toISOString().split('T')[0] : '',
      content: {
        description: proposal?.content?.description || '',
        terms: proposal?.content?.terms || '',
        notes: proposal?.content?.notes || '',
      },
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProposalFormData) => {
      const payload = {
        opportunity_id: data.opportunity_id,
        title: data.title,
        client_name: data.client_name,
        client_email: data.client_email,
        value: data.value ? parseFloat(data.value) : undefined,
        expires_at: data.expires_at || undefined,
        content: data.content,
        status: 'draft',
      };

      if (isEditing) {
        return updateProposal(proposal.id, payload);
      }
      return createProposal(payload);
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      toast({
        title: isEditing ? 'Proposta atualizada' : 'Proposta criada',
        description: 'A proposta foi salva com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const handleGeneratePDF = async () => {
    if (!proposal?.id) return;
    
    setIsGeneratingPDF(true);
    try {
      await generateProposalPDF(proposal.id);
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar PDF', description: error.message });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const opportunities = opportunitiesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opportunity_id">Oportunidade *</Label>
            <Controller
              name="opportunity_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma oportunidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {opportunities.map((opp: any) => (
                      <SelectItem key={opp.id} value={opp.id}>
                        {opp.title || opp.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.opportunity_id && (
              <p className="text-sm text-destructive">{errors.opportunity_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Proposta *</Label>
              <Input id="title" {...register('title')} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Valor</Label>
              <Input
                id="value"
                {...register('value')}
                type="number"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Nome do Cliente</Label>
              <Input id="client_name" {...register('client_name')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_email">Email do Cliente</Label>
              <Input id="client_email" {...register('client_email')} type="email" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires_at">Validade</Label>
            <Input id="expires_at" {...register('expires_at')} type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Produto/Serviço</Label>
            <Textarea id="description" {...register('content.description')} rows={4} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms">Termos e Condições</Label>
            <Textarea id="terms" {...register('content.terms')} rows={4} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...register('content.notes')} rows={3} />
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? 'Gerando...' : 'Gerar PDF'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
