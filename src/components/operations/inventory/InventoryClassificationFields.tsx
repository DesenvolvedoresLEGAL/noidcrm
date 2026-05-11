import { useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CRITICALITY_OPTIONS,
  OPERATIONAL_TYPE_OPTIONS,
  type Criticality,
  type OperationalType,
} from '@/lib/operations/inventoryClassification';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryFamilies } from '@/hooks/operations/useInventoryFamilies';

interface Props {
  categoryId: string;
  familyId: string | null;
  operationalType: OperationalType;
  criticality: Criticality;
  itemKindFilter?: 'serialized' | 'quantity';
  onChange: (next: {
    category_id: string;
    family_id: string | null;
    operational_type: OperationalType;
    criticality: Criticality;
  }) => void;
  onCategoryProfileChange?: (profile: 'generic' | 'router' | 'sim_card') => void;
  errors?: {
    category_id?: { message?: string };
    family_id?: { message?: string };
  };
}

export function InventoryClassificationFields({
  categoryId,
  familyId,
  operationalType,
  criticality,
  itemKindFilter,
  onChange,
  onCategoryProfileChange,
  errors,
}: Props) {
  const { data: categories } = useInventoryCategories();
  const { data: families } = useInventoryFamilies(categoryId || undefined);

  const activeCategories = useMemo(
    () =>
      (categories ?? []).filter(
        (c) => c.is_active && (!itemKindFilter || c.item_kind === itemKindFilter),
      ),
    [categories, itemKindFilter],
  );
  const activeFamilies = useMemo(
    () => (families ?? []).filter((f) => f.is_active),
    [families],
  );

  // Clear family if it doesn't belong to current category anymore
  useEffect(() => {
    if (!categoryId && familyId) {
      onChange({ category_id: categoryId, family_id: null, operational_type: operationalType, criticality });
      return;
    }
    if (familyId && activeFamilies.length > 0 && !activeFamilies.find((f) => f.id === familyId)) {
      onChange({ category_id: categoryId, family_id: null, operational_type: operationalType, criticality });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, activeFamilies]);

  const update = (patch: Partial<{ category_id: string; family_id: string | null; operational_type: OperationalType; criticality: Criticality }>) => {
    onChange({
      category_id: patch.category_id ?? categoryId,
      family_id: patch.family_id !== undefined ? patch.family_id : familyId,
      operational_type: patch.operational_type ?? operationalType,
      criticality: patch.criticality ?? criticality,
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select
          value={categoryId || undefined}
          onValueChange={(v) => update({ category_id: v, family_id: null })}
          disabled={activeCategories.length === 0}
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
        {activeCategories.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Cadastre uma categoria antes de criar itens.
          </p>
        )}
        {errors?.category_id?.message && (
          <p className="text-sm text-destructive">{errors.category_id.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Família</Label>
        <Select
          value={familyId || 'none'}
          onValueChange={(v) => update({ family_id: v === 'none' ? null : v })}
          disabled={!categoryId || activeFamilies.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={categoryId ? 'Selecione uma família (opcional)' : 'Selecione a categoria primeiro'}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem família</SelectItem>
            {activeFamilies.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryId && activeFamilies.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Esta categoria ainda não possui famílias cadastradas.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tipo operacional</Label>
        <Select
          value={operationalType}
          onValueChange={(v) => update({ operational_type: v as OperationalType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATIONAL_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Criticidade</Label>
        <Select
          value={criticality}
          onValueChange={(v) => update({ criticality: v as Criticality })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRITICALITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
