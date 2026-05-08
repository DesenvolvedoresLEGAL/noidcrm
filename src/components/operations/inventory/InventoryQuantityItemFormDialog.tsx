import { useEffect, useMemo } from 'react';
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
  ITEM_STATUS_OPTIONS,
  UNIT_OF_MEASURE_OPTIONS,
  type InventoryItemStatus,
} from '@/lib/operations/inventoryLabels';
import {
  getTechnicalSpecs,
  technicalSpecsArraySchema,
  type TechnicalSpec,
} from '@/lib/operations/inventoryTechnicalSpecs';
import {
  type Criticality,
  type OperationalType,
} from '@/lib/operations/inventoryClassification';
import { TechnicalSpecsSection } from './TechnicalSpecsSection';
import { InventoryClassificationFields } from './InventoryClassificationFields';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryLocations } from '@/hooks/operations/useInventoryLocations';
import { useInventoryQuantityItemMutations } from '@/hooks/operations/useInventoryItems';
import type { InventoryItemWithRefs } from '@/services/operations/inventoryItems';

const STATUSES = [
  'available',
  'blocked',
  'maintenance',
  'damaged',
  'retired',
  'lost',
] as const;

const schema = z
  .object({
    name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
    description: z.string().trim().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
    category_id: z.string().uuid('Selecione uma categoria.'),
    family_id: z.string().uuid().nullable().optional(),
    operational_type: z.enum([
      'equipment','accessory','part','consumable','logical_kit','infrastructure','tool','other',
    ]),
    criticality: z.enum(['low','medium','high','critical']),
    location_id: z.string().uuid('Selecione um local.'),
    status: z.enum(STATUSES),
    unit_of_measure: z.string().min(1, 'Obrigatório').max(20, 'Máximo 20 caracteres'),
    quantity_total: z.coerce.number({ invalid_type_error: 'Número inválido' }).min(0, 'Maior ou igual a 0'),
    quantity_available: z.coerce.number({ invalid_type_error: 'Número inválido' }).min(0, 'Maior ou igual a 0'),
    quantity_minimum: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.union([z.coerce.number().min(0, 'Maior ou igual a 0'), z.null()]),
    ).nullable().optional(),
    brand: z.string().trim().max(80, 'Máximo 80 caracteres').optional().or(z.literal('')),
    model: z.string().trim().max(120, 'Máximo 120 caracteres').optional().or(z.literal('')),
    notes: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
    technical_specs: technicalSpecsArraySchema,
  })
  .refine((d) => d.quantity_available <= d.quantity_total, {
    message: 'A quantidade disponível não pode ser maior que a quantidade total.',
    path: ['quantity_available'],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItemWithRefs | null;
}

export function InventoryQuantityItemFormDialog({ open, onOpenChange, item }: Props) {
  const isEdit = !!item;
  const { create, update } = useInventoryQuantityItemMutations();
  const { data: categories } = useInventoryCategories();
  const { data: locations } = useInventoryLocations();

  const quantityCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active && c.item_kind === 'quantity'),
    [categories],
  );
  const activeLocations = useMemo(
    () => (locations ?? []).filter((l) => l.is_active),
    [locations],
  );

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      description: '',
      category_id: '',
      family_id: null,
      operational_type: 'equipment',
      criticality: 'medium',
      location_id: '',
      status: 'available',
      unit_of_measure: 'un',
      quantity_total: 0,
      quantity_available: 0,
      quantity_minimum: null,
      brand: '',
      model: '',
      notes: '',
      technical_specs: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: item?.name ?? '',
        description: item?.description ?? '',
        category_id: item?.category_id ?? '',
        family_id: (item as any)?.family_id ?? null,
        operational_type: ((item as any)?.operational_type as OperationalType) ?? 'equipment',
        criticality: ((item as any)?.criticality as Criticality) ?? 'medium',
        location_id: item?.location_id ?? '',
        status: ((item?.status as InventoryItemStatus) ?? 'available'),
        unit_of_measure: item?.unit_of_measure ?? 'un',
        quantity_total: Number(item?.quantity_total ?? 0),
        quantity_available: Number(item?.quantity_available ?? 0),
        quantity_minimum:
          item?.quantity_minimum === null || item?.quantity_minimum === undefined
            ? null
            : Number(item.quantity_minimum),
        brand: item?.brand ?? '',
        model: item?.model ?? '',
        notes: item?.notes ?? '',
        technical_specs: getTechnicalSpecs(item?.metadata) as TechnicalSpec[],
      });
    }
  }, [open, item, form]);

  const status = form.watch('status') as InventoryItemStatus;
  const isUnavailable = status !== 'available';

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      category_id: data.category_id,
      family_id: data.family_id ?? null,
      operational_type: data.operational_type,
      criticality: data.criticality,
      location_id: data.location_id,
      status: data.status,
      unit_of_measure: data.unit_of_measure,
      quantity_total: Number(data.quantity_total),
      quantity_available: Number(data.quantity_available),
      quantity_minimum:
        data.quantity_minimum === null || data.quantity_minimum === undefined
          ? null
          : Number(data.quantity_minimum),
      brand: data.brand || null,
      model: data.model || null,
      notes: data.notes || null,
      technical_specs: ((data as any).technical_specs ?? []) as TechnicalSpec[],
    };
    try {
      if (isEdit && item) {
        await update.mutateAsync({
          id: item.id,
          input: { ...payload, _currentMetadata: item.metadata } as any,
        });
        toast.success('Item por quantidade atualizado com sucesso.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Item por quantidade criado com sucesso.');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível concluir a ação. Tente novamente.');
    }
  };

  const pending = create.isPending || update.isPending;
  const noCategories = quantityCategories.length === 0;
  const noLocations = activeLocations.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar item por quantidade' : 'Novo item por quantidade'}</DialogTitle>
          <DialogDescription>
            Cadastre itens controlados por saldo, como cabos, patch cords, adaptadores e materiais de instalação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do item</Label>
            <Input id="name" placeholder="Ex: Cabo de rede CAT6" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Ex: Cabo utilizado para infraestrutura cabeada em eventos."
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.watch('category_id')}
                onValueChange={(v) => form.setValue('category_id', v, { shouldValidate: true })}
                disabled={noCategories}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {quantityCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noCategories && (
                <p className="text-xs text-muted-foreground">
                  Cadastre uma categoria por quantidade antes de criar itens deste tipo.
                </p>
              )}
              {form.formState.errors.category_id && (
                <p className="text-sm text-destructive">{form.formState.errors.category_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Local atual</Label>
              <Select
                value={form.watch('location_id')}
                onValueChange={(v) => form.setValue('location_id', v, { shouldValidate: true })}
                disabled={noLocations}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o local atual" />
                </SelectTrigger>
                <SelectContent>
                  {activeLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noLocations && (
                <p className="text-xs text-muted-foreground">
                  Cadastre um local antes de criar itens.
                </p>
              )}
              {form.formState.errors.location_id && (
                <p className="text-sm text-destructive">{form.formState.errors.location_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as InventoryItemStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade de medida</Label>
              <Select
                value={form.watch('unit_of_measure')}
                onValueChange={(v) => form.setValue('unit_of_measure', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OF_MEASURE_OPTIONS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isUnavailable && (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
              Itens com este status não devem contar como disponíveis. A quantidade disponível será definida como 0.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity_total">Quantidade total</Label>
              <Input
                id="quantity_total"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 100"
                {...form.register('quantity_total')}
              />
              {form.formState.errors.quantity_total && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quantity_total.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity_available">Quantidade disponível</Label>
              <Input
                id="quantity_available"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 80"
                disabled={isUnavailable}
                {...form.register('quantity_available')}
              />
              {form.formState.errors.quantity_available && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quantity_available.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity_minimum">Estoque mínimo</Label>
              <Input
                id="quantity_minimum"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 20"
                {...form.register('quantity_minimum')}
              />
              {form.formState.errors.quantity_minimum && (
                <p className="text-sm text-destructive">
                  {(form.formState.errors.quantity_minimum as any).message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" placeholder="Ex: Furukawa" {...form.register('brand')} />
              {form.formState.errors.brand && (
                <p className="text-sm text-destructive">{form.formState.errors.brand.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" placeholder="Ex: CAT6 Azul" {...form.register('model')} />
              {form.formState.errors.model && (
                <p className="text-sm text-destructive">{form.formState.errors.model.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Ex: Material revisado e disponível para montagem."
              {...form.register('notes')}
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
            )}
          </div>

          <TechnicalSpecsSection
            control={form.control}
            setValue={form.setValue}
            errors={(form.formState.errors as any)?.technical_specs}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || noCategories || noLocations}>
              {pending ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
