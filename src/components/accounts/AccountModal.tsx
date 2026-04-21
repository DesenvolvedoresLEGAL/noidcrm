import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccount, updateAccount, type Account } from '@/services/supabase/accounts';
import { accountKeys } from '@/lib/query-keys';

const accountSchema = z.object({
  cnpj: z.string().optional(),
  razao_social: z.string().min(1, 'Razão Social é obrigatória'),
  nome_fantasia: z.string().optional(),
  segmento: z.string().optional(),
  cnae: z.string().optional(),
  tamanho: z.string().optional(),
  faturamento: z.string().optional(),
  origem_principal: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}

export function AccountModal({ open, onOpenChange, account }: AccountModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!account;

  const { register, handleSubmit, control, formState: { errors } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      cnpj: account?.cnpj || '',
      razao_social: account?.razao_social || '',
      nome_fantasia: account?.nome_fantasia || '',
      segmento: account?.segmento || '',
      cnae: account?.cnae || '',
      tamanho: account?.tamanho || '',
      faturamento: account?.faturamento?.toString() || '',
      origem_principal: account?.origem_principal || '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const payload = {
        ...data,
        faturamento: data.faturamento ? parseFloat(data.faturamento) : undefined,
      };

      if (isEditing) {
        return updateAccount(account.id, payload);
      }
      return createAccount(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      toast({
        title: isEditing ? 'Conta atualizada' : 'Conta criada',
        description: isEditing
          ? 'A conta foi atualizada com sucesso.'
          : 'A conta foi criada com sucesso.',
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

  const onSubmit = (data: AccountFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" {...register('cnpj')} placeholder="00.000.000/0000-00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnae">CNAE</Label>
              <Input id="cnae" {...register('cnae')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="razao_social">Razão Social *</Label>
            <Input id="razao_social" {...register('razao_social')} />
            {errors.razao_social && (
              <p className="text-sm text-destructive">{errors.razao_social.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
            <Input id="nome_fantasia" {...register('nome_fantasia')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento</Label>
              <Input id="segmento" {...register('segmento')} placeholder="Ex: Tecnologia" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tamanho">Tamanho</Label>
              <Controller
                name="tamanho"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pequeno">Pequeno</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Grande">Grande</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="faturamento">Faturamento Anual</Label>
              <Input
                id="faturamento"
                {...register('faturamento')}
                type="number"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem_principal">Origem Principal</Label>
              <Input id="origem_principal" {...register('origem_principal')} placeholder="Ex: Indicação" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
