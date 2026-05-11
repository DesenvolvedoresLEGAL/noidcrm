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
import { ITEM_KIND_OPTIONS } from '@/lib/operations/inventoryLabels';
import { useInventoryCategoryMutations } from '@/hooks/operations/useInventoryCategories';
import type { InventoryCategory } from '@/services/operations/inventoryCategories';
import {
  EQUIPMENT_PROFILE_OPTIONS,
  getEquipmentProfile,
  type EquipmentProfile,
} from '@/lib/operations/inventoryEquipmentProfile';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  item_kind: z.enum(['serialized', 'quantity'], {
    required_error: 'Selecione o tipo padrão',
  }),
  equipment_profile: z.enum(['generic', 'router', 'sim_card']).default('generic'),
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
  category?: InventoryCategory | null;
}

export function InventoryCategoryFormDialog({ open, onOpenChange, category }: Props) {
  const isEdit = !!category;
  const { create, update } = useInventoryCategoryMutations();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      item_kind: 'serialized',
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? '',
        description: category?.description ?? '',
        item_kind: (category?.item_kind as 'serialized' | 'quantity') ?? 'serialized',
        sort_order: category?.sort_order ?? 0,
      });
    }
  }, [open, category, form]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      item_kind: data.item_kind,
      sort_order: data.sort_order,
    };
    try {
      if (isEdit && category) {
        await update.mutateAsync({ id: category.id, input: payload });
        toast.success('Categoria atualizada com sucesso.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Categoria criada com sucesso.');
      }
      onOpenChange(false);
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('Já existe uma categoria com este nome.');
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
          <DialogTitle>{isEdit ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          <DialogDescription>
            Classifique os itens do inventário por tipo operacional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da categoria</Label>
            <Input id="name" placeholder="Ex: Roteadores" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Ex: Equipamentos utilizados para distribuição de internet em eventos."
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
            <Label>Tipo padrão do item</Label>
            <Select
              value={form.watch('item_kind')}
              onValueChange={(v) => form.setValue('item_kind', v as 'serialized' | 'quantity')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Itens serializados possuem identidade única. Itens por quantidade controlam saldo.
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
