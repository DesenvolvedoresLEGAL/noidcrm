import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryFamilyMutations } from '@/hooks/operations/useInventoryFamilies';
import type { InventoryFamily } from '@/services/operations/inventoryFamilies';
import {
  ITEM_KIND_OPTIONS,
  getCategoryControlMode,
  type CategoryControlMode,
} from '@/lib/operations/inventoryLabels';

const schema = z.object({
  category_id: z.string().uuid('Selecione uma categoria.'),
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  item_kind: z.enum(['serialized', 'quantity'], {
    required_error: 'Selecione o tipo padrão do item.',
  }),
  sort_order: z.coerce.number().int('Apenas inteiros').min(0, 'Mínimo 0').default(0),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family?: InventoryFamily | null;
  defaultCategoryId?: string;
}

export function InventoryFamilyFormDialog({ open, onOpenChange, family, defaultCategoryId }: Props) {
  const isEdit = !!family;
  const { data: categories } = useInventoryCategories();
  const { create, update } = useInventoryFamilyMutations();

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { category_id: '', name: '', description: '', sort_order: 0 },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        category_id: family?.category_id ?? defaultCategoryId ?? '',
        name: family?.name ?? '',
        description: family?.description ?? '',
        sort_order: family?.sort_order ?? 0,
      });
    }
  }, [open, family, defaultCategoryId, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && family) {
        await update.mutateAsync({
          id: family.id,
          input: {
            category_id: data.category_id,
            name: data.name,
            description: data.description || null,
            sort_order: data.sort_order,
          },
        });
        toast.success('Família atualizada com sucesso.');
      } else {
        await create.mutateAsync({
          category_id: data.category_id,
          name: data.name,
          description: data.description || null,
          sort_order: data.sort_order,
        });
        toast.success('Família criada com sucesso.');
      }
      onOpenChange(false);
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('Já existe uma família com este nome nesta categoria.');
      } else {
        toast.error(err?.message || 'Não foi possível concluir a ação.');
      }
    }
  };

  const pending = create.isPending || update.isPending;
  const activeCategories = (categories ?? []).filter((c) => c.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar família' : 'Nova família'}</DialogTitle>
          <DialogDescription>
            Famílias são subdivisões dentro de uma categoria, ex.: Roteadores, Switches, Antenas em Conectividade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.watch('category_id') || undefined}
              onValueChange={(v) => form.setValue('category_id', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category_id && (
              <p className="text-sm text-destructive">{form.formState.errors.category_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" placeholder="Ex: Roteadores" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={2} {...form.register('description')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort_order">Ordem</Label>
            <Input
              id="sort_order"
              type="number"
              min="0"
              {...form.register('sort_order', { valueAsNumber: true })}
            />
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
