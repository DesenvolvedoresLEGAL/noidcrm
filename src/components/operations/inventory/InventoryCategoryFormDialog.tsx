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
import {
  CATEGORY_CONTROL_MODE_OPTIONS,
  getCategoryControlMode,
  type CategoryControlMode,
} from '@/lib/operations/inventoryLabels';
import { useInventoryCategoryMutations } from '@/hooks/operations/useInventoryCategories';
import type { InventoryCategory } from '@/services/operations/inventoryCategories';
import {
  CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS,
  CONNECTIVITY_EQUIPMENT_PROFILE_VALUES,
  isConnectivityEquipmentProfile,
  type ConnectivityEquipmentProfile,
} from '@/vertical-packs/connectivity/inventory';

/**
 * Category-level equipment profile at the Inventory Catalog host: Core-neutral
 * `generic` composed with whatever profiles the active Vertical Packs expose.
 * Do NOT redeclare pack literals here.
 */
type CategoryEquipmentProfile = 'generic' | ConnectivityEquipmentProfile;

const CATEGORY_EQUIPMENT_PROFILE_ENUM_VALUES = [
  'generic',
  ...CONNECTIVITY_EQUIPMENT_PROFILE_VALUES,
] as const;

const CATEGORY_EQUIPMENT_PROFILE_OPTIONS: { value: CategoryEquipmentProfile; label: string }[] = [
  { value: 'generic', label: 'Genérico' },
  ...CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS,
];

function normalizeCategoryProfile(value: unknown): CategoryEquipmentProfile {
  return isConnectivityEquipmentProfile(value) ? value : 'generic';
}

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  control_mode: z.enum(['serialized', 'quantity', 'mixed'], {
    required_error: 'Selecione o modo de controle permitido',
  }),
  equipment_profile: z.enum(CATEGORY_EQUIPMENT_PROFILE_ENUM_VALUES).default('generic'),
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
      control_mode: 'serialized',
      equipment_profile: 'generic',
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? '',
        description: category?.description ?? '',
        control_mode: getCategoryControlMode(category),
        equipment_profile: normalizeCategoryProfile((category as any)?.equipment_profile),
        sort_order: category?.sort_order ?? 0,
      });
    }
  }, [open, category, form]);

  const onSubmit = async (data: FormData) => {
    // Mantemos o campo legado `item_kind` espelhado (mixed -> serialized) para
    // compatibilidade com telas antigas. A regra real passa a ser `control_mode`.
    const legacyItemKind: 'serialized' | 'quantity' =
      data.control_mode === 'quantity' ? 'quantity' : 'serialized';
    const payload = {
      name: data.name,
      description: data.description || null,
      item_kind: legacyItemKind,
      control_mode: data.control_mode as CategoryControlMode,
      equipment_profile: data.equipment_profile,
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
            <Label>Modo de controle permitido</Label>
            <Select
              value={form.watch('control_mode')}
              onValueChange={(v) =>
                form.setValue('control_mode', v as CategoryControlMode, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_CONTROL_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Defina se esta categoria aceita itens serializados, itens por quantidade ou ambos.
              O tipo final de cada item é decidido pela família.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Perfil de equipamento</Label>
            <Select
              value={form.watch('equipment_profile')}
              onValueChange={(v) =>
                form.setValue('equipment_profile', v as CategoryEquipmentProfile, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_PROFILE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Roteador exige SSID/senha de fábrica e IMEI. Chip exige ICCID, linha e APN.
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
