import { useEffect, useMemo, useState } from 'react';
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
  mapDuplicateError,
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
import {
  getRouterFactory,
  getSimCardFactory,
  routerFactorySchema,
  simCardFactorySchema,
  type EquipmentProfile,
  type RouterFactory,
  type SimCardFactory,
} from '@/lib/operations/inventoryEquipmentProfile';
import { TechnicalSpecsSection } from './TechnicalSpecsSection';
import { InventoryClassificationFields } from './InventoryClassificationFields';
import {
  RouterFactoryFields,
  SimCardFactoryFields,
} from './EquipmentProfileFactoryFields';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryLocations } from '@/hooks/operations/useInventoryLocations';
import { useInventoryItemMutations } from '@/hooks/operations/useInventoryItems';
import type { InventoryItemWithRefs } from '@/services/operations/inventoryItems';
import { showFormErrors } from '@/lib/operations/formErrorFeedback';
import { useInventoryCategoryMutations } from '@/hooks/operations/useInventoryCategories';
import { AlertCircle, Wifi } from 'lucide-react';

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
    asset_code: z.string().trim().max(80, 'Máximo 80 caracteres').optional().or(z.literal('')),
    serial_number: z
      .string()
      .trim()
      .max(120, 'Máximo 120 caracteres')
      .optional()
      .or(z.literal('')),
    brand: z.string().trim().max(80, 'Máximo 80 caracteres').optional().or(z.literal('')),
    model: z.string().trim().max(120, 'Máximo 120 caracteres').optional().or(z.literal('')),
    notes: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
    technical_specs: technicalSpecsArraySchema,
    equipment_profile: z.enum(['generic', 'router', 'sim_card']).default('generic'),
    router_factory: routerFactorySchema.partial().optional(),
    sim_card_factory: simCardFactorySchema.partial().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.equipment_profile === 'router') {
      const r = routerFactorySchema.safeParse(val.router_factory ?? {});
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['router_factory', ...issue.path] });
        }
      }
    } else if (val.equipment_profile === 'sim_card') {
      const r = simCardFactorySchema.safeParse(val.sim_card_factory ?? {});
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['sim_card_factory', ...issue.path] });
        }
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItemWithRefs | null;
}

export function InventoryItemFormDialog({ open, onOpenChange, item }: Props) {
  const isEdit = !!item;
  const { create, update } = useInventoryItemMutations();
  const { data: categories } = useInventoryCategories();
  const { data: locations } = useInventoryLocations();

  const serializedCategories = useMemo(
    () =>
      (categories ?? []).filter((c) => c.is_active && c.item_kind === 'serialized'),
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
      asset_code: '',
      serial_number: '',
      brand: '',
      model: '',
      notes: '',
      technical_specs: [],
      equipment_profile: 'generic',
      router_factory: { ssid_factory: '', wifi_password_factory: '', admin_user: '', admin_password: '', imei: '' },
      sim_card_factory: { iccid: '', line_number: '', carrier: '', apn: '', pin: '' },
    },
  });

  const [profile, setProfile] = useState<EquipmentProfile>('generic');

  useEffect(() => {
    if (open) {
      const initialProfile = (((item as any)?.category?.equipment_profile) ?? 'generic') as EquipmentProfile;
      setProfile(initialProfile === 'router' || initialProfile === 'sim_card' ? initialProfile : 'generic');
      const router = getRouterFactory(item?.metadata) ?? { ssid_factory: '', wifi_password_factory: '', admin_user: '', admin_password: '', imei: '' };
      const sim = getSimCardFactory(item?.metadata) ?? { iccid: '', line_number: '', carrier: '', apn: '', pin: '' };
      form.reset({
        name: item?.name ?? '',
        description: item?.description ?? '',
        category_id: item?.category_id ?? '',
        family_id: (item as any)?.family_id ?? null,
        operational_type: ((item as any)?.operational_type as OperationalType) ?? 'equipment',
        criticality: ((item as any)?.criticality as Criticality) ?? 'medium',
        location_id: item?.location_id ?? '',
        status: ((item?.status as InventoryItemStatus) ?? 'available'),
        asset_code: item?.asset_code ?? '',
        serial_number: item?.serial_number ?? '',
        brand: item?.brand ?? '',
        model: item?.model ?? '',
        notes: item?.notes ?? '',
        technical_specs: getTechnicalSpecs(item?.metadata) as TechnicalSpec[],
        equipment_profile: initialProfile,
        router_factory: router,
        sim_card_factory: sim,
      });
    }
  }, [open, item, form]);

  const onSubmit = async (data: FormData) => {
    const payload: any = {
      name: data.name,
      description: data.description || null,
      category_id: data.category_id,
      family_id: data.family_id ?? null,
      operational_type: data.operational_type,
      criticality: data.criticality,
      location_id: data.location_id,
      status: data.status,
      asset_code: data.asset_code || null,
      serial_number: data.serial_number || null,
      brand: data.brand || null,
      model: data.model || null,
      notes: data.notes || null,
      technical_specs: (data.technical_specs ?? []) as TechnicalSpec[],
      router_factory: profile === 'router' ? (data.router_factory as RouterFactory) : null,
      sim_card_factory: profile === 'sim_card' ? (data.sim_card_factory as SimCardFactory) : null,
    };
    try {
      if (isEdit && item) {
        await update.mutateAsync({
          id: item.id,
          input: { ...payload, _currentMetadata: item.metadata } as any,
        });
        toast.success('Item atualizado com sucesso.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Item criado com sucesso.');
      }
      onOpenChange(false);
    } catch (err: any) {
      const dup = mapDuplicateError(err);
      toast.error(dup ?? err?.message ?? 'Não foi possível concluir a ação. Tente novamente.');
    }
  };

  const pending = create.isPending || update.isPending;
  const noCategories = serializedCategories.length === 0;
  const noLocations = activeLocations.length === 0;

  // Detect when the chosen category looks like a router/chip but the profile is generic
  const selectedCategory = useMemo(
    () => (categories ?? []).find((c) => c.id === form.watch('category_id')),
    [categories, form.watch('category_id')],
  );
  const categoryName = (selectedCategory as any)?.name as string | undefined;
  const looksLikeRouter = !!categoryName && /(rote|wifi|wi-fi|modem|router)/i.test(categoryName);
  const looksLikeSim = !!categoryName && /(chip|sim|esim)/i.test(categoryName);
  const profileMismatch =
    profile === 'generic' && (looksLikeRouter || looksLikeSim) && !!selectedCategory;

  const { update: updateCategory } = useInventoryCategoryMutations();
  const promoteCategoryProfile = async () => {
    if (!selectedCategory) return;
    const desired: 'router' | 'sim_card' = looksLikeRouter ? 'router' : 'sim_card';
    try {
      await updateCategory.mutateAsync({
        id: selectedCategory.id,
        input: { equipment_profile: desired },
      });
      setProfile(desired);
      form.setValue('equipment_profile', desired, { shouldValidate: true });
      toast.success(
        desired === 'router'
          ? 'Categoria marcada como Roteador. Preencha os dados de fábrica abaixo.'
          : 'Categoria marcada como Chip. Preencha os dados do SIM abaixo.',
      );
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível atualizar a categoria.');
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar item' : 'Novo item'}</DialogTitle>
          <DialogDescription>
            Cadastre ativos físicos únicos do inventário, como roteadores, switches e tablets.
          </DialogDescription>
        </DialogHeader>

        {(noCategories || noLocations) && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Cadastro incompleto antes de criar itens.</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {noCategories && <li>Crie ao menos uma categoria do tipo "Serializado".</li>}
                {noLocations && <li>Crie ao menos um local de inventário ativo.</li>}
              </ul>
            </div>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit, showFormErrors)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do item</Label>
            <Input id="name" placeholder="Ex: Router BLUE 001" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Ex: Roteador principal utilizado em eventos corporativos."
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <InventoryClassificationFields
            categoryId={form.watch('category_id')}
            familyId={form.watch('family_id') ?? null}
            operationalType={form.watch('operational_type') as OperationalType}
            criticality={form.watch('criticality') as Criticality}
            itemKindFilter="serialized"
            onChange={(next) => {
              form.setValue('category_id', next.category_id, { shouldValidate: true });
              form.setValue('family_id', next.family_id);
              form.setValue('operational_type', next.operational_type);
              form.setValue('criticality', next.criticality);
            }}
            onCategoryProfileChange={(p) => {
              setProfile(p);
              form.setValue('equipment_profile', p, { shouldValidate: true });
            }}
            errors={{
              category_id: form.formState.errors.category_id as any,
              family_id: form.formState.errors.family_id as any,
            }}
          />

          {profile === 'router' && <RouterFactoryFields form={form} />}
          {profile === 'sim_card' && <SimCardFactoryFields form={form} />}

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
              <p className="text-sm text-destructive">
                {form.formState.errors.location_id.message}
              </p>
            )}
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset_code">Código patrimonial</Label>
              <Input
                id="asset_code"
                placeholder="Ex: RT-BLUE-001"
                {...form.register('asset_code')}
              />
              {form.formState.errors.asset_code && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.asset_code.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial_number">Número de série</Label>
              <Input
                id="serial_number"
                placeholder="Ex: SN123456789"
                {...form.register('serial_number')}
              />
              {form.formState.errors.serial_number && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.serial_number.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" placeholder="Ex: Intelbras" {...form.register('brand')} />
              {form.formState.errors.brand && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.brand.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" placeholder="Ex: GX 3000" {...form.register('model')} />
              {form.formState.errors.model && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.model.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Ex: Equipamento revisado e pronto para uso."
              {...form.register('notes')}
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-destructive">
                {form.formState.errors.notes.message}
              </p>
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
