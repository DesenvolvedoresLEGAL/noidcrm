// NOID-VERTICAL-1.0-VERT-02.6
// Editor view for product inventory requirements.
// The view is Pack-agnostic: it consumes vertical concerns (default unit
// basis + presentation copy + provider applicability) exclusively via the
// `verticalPolicy` prop resolved by the composition boundary. It knows
// nothing about Foundation Registry, contributions, PackId or provenance.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Pencil,
  Power,
  AlertCircle,
  Package,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

import {
  inventoryProductRequirementSchema,
  UNIT_BASIS_LABELS,
  UNIT_BASIS_VALUES,
  ITEM_KIND_LABELS,
  type InventoryProductRequirement,
  type InventoryProductRequirementInput,
  type UnitBasis,
} from '@/inventory/requirements';
import {
  useCreateInventoryProductRequirement,
  useDeactivateInventoryProductRequirement,
  useInventoryProductRequirements,
  useUpdateInventoryProductRequirement,
} from '@/inventory/hooks/useInventoryProductRequirements';
import {
  useInventoryProvider,
  useInventoryCategories,
  useInventoryFamilies,
} from '@/inventory/hooks/useInventoryProvider';
import type {
  InventoryCategory,
  InventoryFamily,
  InventoryProviderType,
} from '@/inventory/providers/types';

import type { ResolvedInventoryProductRequirementsPolicy } from '@/vertical/composition/inventoryProductRequirementsComposition';

interface Props {
  organizationId: string;
  productId: string;
  canEdit: boolean;
  verticalPolicy: ResolvedInventoryProductRequirementsPolicy;
}


const previewBasisText = (input: {
  quantity: number;
  unit_basis: UnitBasis;
}) => {
  const q = Number(input.quantity) || 0;
  switch (input.unit_basis) {
    case 'per_point':
      return q === 1
        ? 'Na proposta, este recurso será multiplicado pela quantidade de pontos vendidos.'
        : `Na proposta, serão exigidas ${q} unidades desta família para cada ponto vendido.`;
    case 'per_event':
      return 'Na proposta, esta quantidade será fixa por evento.';
    case 'per_day':
      return 'Na proposta, a quantidade será multiplicada pelas diárias.';
    case 'per_participant':
      return 'Na proposta, a quantidade será multiplicada pelo número de participantes.';
    case 'per_unit':
      return 'Na proposta, a quantidade será multiplicada pela quantidade do produto vendido.';
    case 'manual':
      return 'A quantidade será definida manualmente na proposta.';
  }
};

export function ProductInventoryRequirementsEditor({
  organizationId,
  productId,
  canEdit,
  verticalPolicy,
}: Props) {

  const { toast } = useToast();

  const {
    provider,
    providerType,
    providerName,
    status: providerStatus,
    isLoading: loadingProvider,
  } = useInventoryProvider(organizationId);

  const providerSupportsRequirements =
    !!provider &&
    provider.hasCapability('product_requirements') &&
    verticalPolicy.providerSupportedByPack;


  const { data: categories = [], isLoading: loadingCategories } =
    useInventoryCategories(providerSupportsRequirements ? organizationId : null);
  const { data: families = [], isLoading: loadingFamilies } =
    useInventoryFamilies(providerSupportsRequirements ? organizationId : null);

  const {
    data: requirements = [],
    isLoading: loadingReqs,
    error: requirementsError,
  } = useInventoryProductRequirements({ organizationId, productId });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryProductRequirement | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    useState<InventoryProductRequirement | null>(null);

  const scope = { organizationId, productId };
  const createMut = useCreateInventoryProductRequirement(scope);
  const updateMut = useUpdateInventoryProductRequirement(scope);
  const deactivateMut = useDeactivateInventoryProductRequirement(scope);

  const loadingCache = loadingProvider || loadingCategories || loadingFamilies;
  const providerIsNative = providerType === 'native';
  const integrationMissing =
    !providerIsNative &&
    (providerStatus?.code === 'not_configured' ||
      providerStatus?.code === 'unavailable');
  const cacheEmpty =
    providerSupportsRequirements && categories.length === 0 && !loadingCache;

  const canOpenCreate =
    !loadingProvider &&
    !!providerType &&
    providerSupportsRequirements &&
    !integrationMissing &&
    !cacheEmpty;

  const providerConfigHref = providerType
    ? `/app/settings/inventory-provider?provider=${providerType}`
    : '/app/settings/inventory-provider';

  const openCreate = () => {
    if (!canOpenCreate) return;
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (r: InventoryProductRequirement) => {
    setEditing(r);
    setDialogOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateMut.mutateAsync(deactivateTarget.id);
      toast({ title: 'Composição desativada.' });
      setDeactivateTarget(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao desativar',
        description: (err as Error).message,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label className="text-base">Composição de Inventário</Label>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Defina quais recursos de inventário este produto exige para ser
            entregue. Essa composição é utilizada no cálculo de demanda e poderá
            alimentar recursos de disponibilidade e operação quando suportados
            pelo provider ativo.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            A quantidade representa o consumo físico por base comercial. Ex.:
            1 roteador por ponto.
          </p>
          {providerName && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Provider ativo: <span className="font-medium">{providerName}</span>
            </p>
          )}
        </div>
        {canEdit && canOpenCreate && (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nova composição
          </Button>
        )}
      </div>

      {requirementsError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Não foi possível carregar a composição de inventário deste produto.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tente novamente em instantes. Se o problema persistir, contate o
                suporte.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {providerIsNative && (
        <Card className="border-dashed">
          <CardContent className="pt-4 flex items-start gap-3">
            <Package className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Provider de inventário nativo ativo.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este produto pode ser cadastrado normalmente. A composição de
                inventário e consulta de disponibilidade dependem de uma
                integração de inventário externa, que não está configurada para
                esta organização.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {integrationMissing && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Configure a integração de inventário ({providerName}) antes de
                vincular a composição.
              </p>
              <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                <Link to={providerConfigHref}>
                  Abrir configuração de inventário <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!integrationMissing && !providerIsNative && cacheEmpty && (
        <Card className="border-dashed">
          <CardContent className="pt-4 flex items-start gap-3">
            <Package className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Nenhuma categoria ou família de inventário sincronizada ainda.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sincronize categorias e famílias na configuração do provider
                para habilitar a composição deste produto.
              </p>
              <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                <Link to={providerConfigHref}>
                  Abrir configuração de inventário{' '}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loadingReqs && !requirementsError && requirements.length === 0 && !providerIsNative && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center space-y-1">
            <p className="text-sm font-medium">
              Este produto não possui composição de inventário.
            </p>
            <p className="text-xs text-muted-foreground max-w-xl mx-auto">
              Use composição apenas quando o produto exigir recursos físicos do
              provider de inventário para ser entregue. Produtos de serviço puro
              podem ficar sem composição.
            </p>
          </CardContent>
        </Card>
      )}

      {requirements.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Rótulo</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-left px-3 py-2">Família</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Qtd</th>
                <th className="text-left px-3 py-2">Base</th>
                <th className="text-left px-3 py-2">Obrigatório</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((r) => {
                const providerMismatch =
                  !!providerType && r.provider_type !== providerType;
                const editDisabled = providerMismatch;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2">{r.category_name}</td>
                    <td className="px-3 py-2">{r.family_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.item_kind
                        ? ITEM_KIND_LABELS[r.item_kind] ?? '—'
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(r.quantity)}
                    </td>
                    <td className="px-3 py-2">{UNIT_BASIS_LABELS[r.unit_basis]}</td>
                    <td className="px-3 py-2">
                      {r.is_required ? (
                        <Badge variant="default">Obrigatório</Badge>
                      ) : (
                        <Badge variant="secondary">Opcional</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.is_active ? (
                        <Badge variant="outline">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(r)}
                            disabled={editDisabled}
                            aria-label="Editar"
                            title={
                              providerMismatch
                                ? `Requisito vinculado a outro provider (${r.provider_type}).`
                                : undefined
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {r.is_active && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeactivateTarget(r)}
                              aria-label="Desativar"
                            >
                              <Power className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && providerType && (
        <RequirementDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          categories={categories}
          families={families}
          providerType={providerType}
          initial={editing}
          onSubmit={async (values) => {
            try {
              if (editing) {
                await updateMut.mutateAsync({ id: editing.id, input: values });
                toast({ title: 'Composição atualizada.' });
              } else {
                await createMut.mutateAsync(values);
                toast({ title: 'Composição criada com sucesso.' });
              }
              setDialogOpen(false);
            } catch (err) {
              toast({
                variant: 'destructive',
                title: 'Erro ao salvar composição',
                description: (err as Error).message,
              });
            }
          }}
          submitting={createMut.isPending || updateMut.isPending}
        />
      )}

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar composição?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desativar esta composição? Ela não será usada nas próximas
              consultas de disponibilidade, mas o histórico será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: InventoryCategory[];
  families: InventoryFamily[];
  providerType: InventoryProviderType;
  initial: InventoryProductRequirement | null;
  onSubmit: (values: InventoryProductRequirementInput) => void | Promise<void>;
  submitting: boolean;
}

function RequirementDialog({
  open,
  onOpenChange,
  categories,
  families,
  providerType,
  initial,
  onSubmit,
  submitting,
}: DialogProps) {
  const form = useForm<InventoryProductRequirementInput>({
    resolver: zodResolver(inventoryProductRequirementSchema) as never,
    defaultValues: initial
      ? {
          label: initial.label,
          provider_type: initial.provider_type,
          category_ref: initial.category_ref,
          category_name: initial.category_name,
          family_ref: initial.family_ref,
          family_name: initial.family_name,
          item_kind: initial.item_kind ?? null,
          quantity: Number(initial.quantity),
          unit_basis: initial.unit_basis,
          is_required: initial.is_required,
          notes: initial.notes ?? '',
          sort_order: initial.sort_order,
          is_active: initial.is_active,
        }
      : {
          label: '',
          provider_type: providerType,
          category_ref: '',
          category_name: '',
          family_ref: '',
          family_name: '',
          item_kind: null,
          quantity: 1,
          unit_basis: 'per_point',
          is_required: true,
          notes: '',
          sort_order: 0,
          is_active: true,
        },
  });

  const categoryRef = form.watch('category_ref');
  const quantity = form.watch('quantity');
  const unitBasis = form.watch('unit_basis');
  const filteredFamilies = families.filter((f) => f.categoryId === categoryRef);

  const onCategoryChange = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    form.setValue('category_ref', id);
    form.setValue('category_name', cat?.name ?? '');
    form.setValue('family_ref', '');
    form.setValue('family_name', '');
    form.setValue('item_kind', null);
  };

  const onFamilyChange = (id: string) => {
    const fam = filteredFamilies.find((f) => f.id === id);
    form.setValue('family_ref', id);
    form.setValue('family_name', fam?.name ?? '');
    form.setValue('item_kind', fam?.itemKind ?? null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? 'Editar composição' : 'Nova composição'}
          </DialogTitle>
          <DialogDescription>
            Vincule uma categoria e família do provider a este produto.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          id="pir-form"
        >
          <div>
            <Label>Rótulo *</Label>
            <Input
              {...form.register('label')}
              placeholder="Ex: Roteador 5G Indoor"
            />
            {form.formState.errors.label && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.label.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Categoria de inventário *</Label>
              <Select value={categoryRef} onValueChange={onCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category_ref && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.category_ref.message}
                </p>
              )}
            </div>
            <div>
              <Label>Família de inventário *</Label>
              <Select
                value={form.watch('family_ref')}
                onValueChange={onFamilyChange}
                disabled={!categoryRef}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredFamilies.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">
                      Nenhuma família sincronizada para esta categoria.
                    </div>
                  ) : (
                    filteredFamilies.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.family_ref && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.family_ref.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...form.register('quantity')}
              />
              {form.formState.errors.quantity && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>
            <div>
              <Label>Base de consumo *</Label>
              <Select
                value={unitBasis}
                onValueChange={(v) => form.setValue('unit_basis', v as UnitBasis)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_BASIS_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {UNIT_BASIS_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Define como a quantidade será multiplicada na proposta.
              </p>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" step="1" {...form.register('sort_order')} />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {previewBasisText({
              quantity: Number(quantity) || 0,
              unit_basis: unitBasis,
            })}
          </div>

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <Label className="text-sm">Obrigatório</Label>
              <p className="text-xs text-muted-foreground max-w-md">
                Itens obrigatórios entram na consulta de disponibilidade. Itens
                opcionais podem ser usados como recomendação ou complemento.
              </p>
            </div>
            <Switch
              checked={form.watch('is_required')}
              onCheckedChange={(c) => form.setValue('is_required', c)}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              rows={3}
              maxLength={300}
              {...form.register('notes')}
              placeholder="Ex: Usado em pontos de conectividade indoor."
            />
            {form.formState.errors.notes && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>

          {initial && (
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label className="text-sm">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Composições inativas não são usadas em consultas futuras.
                </p>
              </div>
              <Switch
                checked={form.watch('is_active')}
                onCheckedChange={(c) => form.setValue('is_active', c)}
              />
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" form="pir-form" disabled={submitting}>
            {initial ? 'Salvar alterações' : 'Criar composição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
