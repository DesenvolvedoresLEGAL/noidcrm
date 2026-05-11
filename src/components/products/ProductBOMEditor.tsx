import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { listProductBomItems, type ProductBomItemInput } from '@/services/supabase/product-bom';
import { listInventoryCategories } from '@/services/operations/inventoryCategories';
import { listInventoryFamilies } from '@/services/operations/inventoryFamilies';

export interface ProductBOMEditorProps {
  organizationId: string;
  productId: string | null;
  value: ProductBomItemInput[];
  onChange: (items: ProductBomItemInput[]) => void;
}

export function ProductBOMEditor({ organizationId, productId, value, onChange }: ProductBOMEditorProps) {
  const [hydrated, setHydrated] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['product-bom', productId],
    queryFn: () => (productId ? listProductBomItems(productId) : Promise.resolve([])),
    enabled: !!productId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories', organizationId],
    queryFn: () => listInventoryCategories(organizationId),
    enabled: !!organizationId,
  });

  const { data: families = [] } = useQuery({
    queryKey: ['inventory-families', organizationId],
    queryFn: () => listInventoryFamilies(organizationId),
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (productId && existing && !hydrated) {
      onChange(
        existing.map((e) => ({
          component_product_id: e.component_product_id,
          inventory_category_id: e.inventory_category_id,
          inventory_family_id: e.inventory_family_id,
          quantity_per_point: e.quantity_per_point,
          label: e.label,
          notes: e.notes,
          order_index: e.order_index,
        })),
      );
      setHydrated(true);
    }
  }, [existing, hydrated, productId, onChange]);

  const updateRow = (idx: number, patch: Partial<ProductBomItemInput>) => {
    const next = value.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...value,
      {
        quantity_per_point: 1,
        label: '',
        inventory_category_id: null,
        inventory_family_id: null,
        order_index: value.length,
      },
    ]);
  };

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Composição técnica (BOM)</Label>
          <p className="text-xs text-muted-foreground">
            Define os componentes reservados por <strong>cada ponto</strong>. Reserva total = pontos × quantidade aqui.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
          Nenhum componente. Sem BOM, a reserva usa o próprio produto.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, idx) => {
            const familyOptions = families.filter(
              (f) => !row.inventory_category_id || f.category_id === row.inventory_category_id,
            );
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md bg-muted/30">
                <div className="col-span-1 flex items-center justify-center text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Rótulo</Label>
                  <Input
                    value={row.label ?? ''}
                    onChange={(e) => updateRow(idx, { label: e.target.value })}
                    placeholder="Ex.: Roteador 4G"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Categoria</Label>
                  <Select
                    value={row.inventory_category_id ?? ''}
                    onValueChange={(v) =>
                      updateRow(idx, { inventory_category_id: v || null, inventory_family_id: null })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Família</Label>
                  <Select
                    value={row.inventory_family_id ?? ''}
                    onValueChange={(v) => updateRow(idx, { inventory_family_id: v || null })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {familyOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Qtd/ponto</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={row.quantity_per_point}
                    onChange={(e) =>
                      updateRow(idx, { quantity_per_point: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(idx)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
