import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { LOCATION_TYPE_OPTIONS } from '@/lib/operations/inventoryLabels';
import { useInventoryLocationMutations } from '@/hooks/operations/useInventoryLocations';
import type {
  InventoryLocation,
  InventoryLocationType,
} from '@/services/operations/inventoryLocations';

const LOCATION_TYPES = [
  'internal',
  'external',
  'maintenance',
  'event',
  'technician',
  'lost',
  'retired',
  'other',
] as const;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  location_type: z.enum(LOCATION_TYPES, { required_error: 'Selecione o tipo' }),
  sort_order: z
    .number({ invalid_type_error: 'Informe um número inteiro' })
    .int('Apenas números inteiros')
    .min(0, 'Mínimo 0')
    .default(0),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: InventoryLocation | null;
}

export function InventoryLocationFormDialog({ open, onOpenChange, location }: Props) {
  const isEdit = !!location;
  const { create, update } = useInventoryLocationMutations();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      location_type: 'internal',
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: location?.name ?? '',
        description: location?.description ?? '',
        location_type: (location?.location_type as InventoryLocationType) ?? 'internal',
        sort_order: location?.sort_order ?? 0,
      });
    }
  }, [open, location, form]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      location_type: data.location_type,
      sort_order: data.sort_order,
    };
    try {
      if (isEdit && location) {
        await update.mutateAsync({ id: location.id, input: payload });
        toast.success('Local atualizado com sucesso.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Local criado com sucesso.');
      }
      onOpenChange(false);
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('Já existe um local com este nome.');
      } else {
        toast.error(err?.message || 'Não foi possível concluir a ação. Tente novamente.');
      }
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar local' : 'Novo local'}</DialogTitle>
          <DialogDescription>
            Controle os locais físicos e operacionais onde os itens podem estar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do local</Label>
            <Input id="name" placeholder="Ex: Estoque LEGAL" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Ex: Local principal para armazenamento dos equipamentos disponíveis."
              rows={3}
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de local</Label>
            <Select
              value={form.watch('location_type')}
              onValueChange={(v) => form.setValue('location_type', v as InventoryLocationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O tipo ajuda o sistema a entender onde o item está no fluxo operacional.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort_order">Ordem</Label>
            <Input
              id="sort_order"
              type="number"
              placeholder="0"
              {...form.register('sort_order', { valueAsNumber: true })}
            />
            {form.formState.errors.sort_order && (
              <p className="text-sm text-destructive">
                {form.formState.errors.sort_order.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
