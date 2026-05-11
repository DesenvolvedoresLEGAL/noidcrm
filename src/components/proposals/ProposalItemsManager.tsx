import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Package, ChevronUp, ChevronDown, Repeat, Zap } from 'lucide-react';
import { ProposalItem } from '@/services/crm/proposal-items';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { Textarea } from '@/components/ui/textarea';
import { useMeasurementUnits } from '@/hooks/useMeasurementUnits';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MiniRichTextEditor } from './MiniRichTextEditor';
import { Badge } from '@/components/ui/badge';

interface ProposalItemsManagerProps {
  items: ProposalItem[];
  onChange: (items: ProposalItem[]) => void;
  paymentDiscountPercent?: number;
}

// Calculate totals with point_day support
function calculateItemTotalsLocal(item: Partial<ProposalItem>): Partial<ProposalItem> {
  const discountPercent = item.discount_percent || 0;

  if (item.billing_type === 'point_day') {
    const points = Math.max(1, Number(item.quantity_points || 1));
    const days = Math.max(1, Number(item.billing_days || 1));
    const ppd = Number(item.unit_price_point_day || item.unit_price || 0);
    const total = points * days * ppd * (1 - discountPercent / 100);
    return {
      ...item,
      quantity_points: points,
      billing_days: days,
      unit_price_point_day: Number(ppd.toFixed(2)),
      quantity: points * days,
      unit_price: Number(ppd.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  const quantity = item.quantity || 1;
  const unitPrice = item.unit_price || 0;
  const subtotal = unitPrice * quantity;
  const total = subtotal * (1 - discountPercent / 100);

  return {
    ...item,
    unit_price: Number(unitPrice.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

// Calculate markup from unit_cost and unit_price
function calculateMarkup(unitCost: number, unitPrice: number): number {
  if (unitCost <= 0) return 0;
  return ((unitPrice - unitCost) / unitCost) * 100;
}

export function ProposalItemsManager({ items, onChange, paymentDiscountPercent = 0 }: ProposalItemsManagerProps) {
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const { organization } = useCurrentOrganization();
  const { units: measurementUnits } = useMeasurementUnits();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch products with billing_type
  const { data: products } = useQuery({
    queryKey: ['products', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('active', true);
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const handleAddItem = (newItem: Partial<ProposalItem>) => {
    const itemWithCalculations = calculateItemTotalsLocal({
      ...newItem,
      order_index: items.length,
    });

    const item: ProposalItem = {
      id: `temp-${Date.now()}`,
      proposal_id: items[0]?.proposal_id || '',
      order_index: items.length,
      name: newItem.name || '',
      description: newItem.description,
      quantity: itemWithCalculations.quantity ?? newItem.quantity ?? 1,
      unit_cost: newItem.unit_cost || 0,
      markup_percent: newItem.markup_percent || 0,
      unit_price: itemWithCalculations.unit_price || 0,
      ipi_percent: 0,
      discount_percent: newItem.discount_percent || 0,
      total: itemWithCalculations.total || 0,
      product_id: newItem.product_id,
      image_url: newItem.image_url,
      characteristics: newItem.characteristics,
      measurement_unit_id: newItem.measurement_unit_id,
      billing_type: newItem.billing_type || 'one_time',
      counts_for_commission: newItem.counts_for_commission ?? true,
      minimum_contract_months: newItem.minimum_contract_months || 1,
      quantity_points: itemWithCalculations.quantity_points ?? newItem.quantity_points,
      billing_days: itemWithCalculations.billing_days ?? newItem.billing_days,
      unit_price_point_day: itemWithCalculations.unit_price_point_day ?? newItem.unit_price_point_day,
    };

    onChange([...items, item]);
    setAddProductModalOpen(false);
  };

  const handleUpdateItem = (id: string, updates: Partial<ProposalItem>) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, ...updates };
        
        // Recalculate markup as INFORMATIVE only
        if (updates.unit_price !== undefined || updates.unit_cost !== undefined) {
          updatedItem.markup_percent = Number(calculateMarkup(updatedItem.unit_cost, updatedItem.unit_price).toFixed(2));
        }

        const withCalculations = calculateItemTotalsLocal(updatedItem);
        return { ...updatedItem, ...withCalculations };
      }
      return item;
    });
    onChange(updatedItems);
  };

  const handleDeleteItem = (id: string) => {
    const filteredItems = items.filter(item => item.id !== id);
    const reindexed = filteredItems.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    onChange(reindexed);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      const reordered = arrayMove(items, oldIndex, newIndex);
      const reindexed = reordered.map((item, index) => ({
        ...item,
        order_index: index,
      }));
      onChange(reindexed);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const reordered = arrayMove(items, index, newIndex);
    const reindexed = reordered.map((item, idx) => ({
      ...item,
      order_index: idx,
    }));
    onChange(reindexed);
  };

  // Calculate totals by billing type - with fallback for legacy items
  const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
  const recurringItems = items.filter(item => item.billing_type === 'recurring');
  
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
  const recurringTotal = recurringItems.reduce((sum, item) => sum + item.total, 0);
  
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => {
    const itemSubtotal = item.unit_price * item.quantity;
    const itemDiscount = itemSubtotal * (item.discount_percent / 100);
    return sum + itemDiscount;
  }, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  // Calculate contract months from items' minimum_contract_months
  const contractMonths = recurringItems.length > 0 
    ? Math.max(...recurringItems.map(item => (item as any).minimum_contract_months || 1), 1)
    : 12;
  const recurringContractTotal = recurringTotal * contractMonths;
  
  // Apply payment discount to one-time total
  const paymentDiscountAmount = oneTimeTotal * (paymentDiscountPercent / 100);
  const oneTimeWithPaymentDiscount = oneTimeTotal - paymentDiscountAmount;
  const grandTotal = oneTimeWithPaymentDiscount + recurringContractTotal;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Itens da Proposta</CardTitle>
        <Dialog open={addProductModalOpen} onOpenChange={setAddProductModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full h-[100dvh] max-w-full md:max-w-2xl md:h-auto md:max-h-[90vh] rounded-none md:rounded-lg overflow-y-auto p-4 md:p-6">
            <DialogHeader>
              <DialogTitle>Adicionar Item</DialogTitle>
            </DialogHeader>
            <AddItemForm 
              products={products || []} 
              measurementUnits={measurementUnits}
              onAdd={handleAddItem}
              onCancel={() => setAddProductModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum item adicionado ainda.</p>
            <p className="text-sm">Clique em "Adicionar Item" para começar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordem</TableHead>
                      <TableHead className="min-w-[200px]">Item</TableHead>
                      <TableHead className="w-24">Tipo</TableHead>
                      <TableHead className="w-20">Qtd</TableHead>
                      <TableHead className="w-20">Un.</TableHead>
                      <TableHead className="w-28">Custo Un.</TableHead>
                      <TableHead className="w-32">Preço Un.</TableHead>
                      <TableHead className="w-20">Desc. %</TableHead>
                      <TableHead className="w-32 text-right">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext
                    items={items.map(item => item.id!)}
                    strategy={verticalListSortingStrategy}
                  >
                    <TableBody>
                      {items.map((item, index) => (
                        <SortableRow 
                          key={item.id} 
                          item={item}
                          index={index}
                          totalItems={items.length}
                          measurementUnits={measurementUnits}
                          onUpdate={handleUpdateItem}
                          onDelete={handleDeleteItem}
                          onMove={moveItem}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </DndContext>
            </div>

            {/* RESUMO - World Class Design */}
            <div className="flex justify-end">
              <div className="w-full max-w-md space-y-3 border rounded-lg p-4 bg-muted/20">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Resumo da Proposta
                </div>

                {/* Avulso Section */}
                {oneTimeItems.length > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      Total Avulso ({oneTimeItems.length} {oneTimeItems.length === 1 ? 'item' : 'itens'}):
                    </span>
                    <span className="font-semibold">
                      R$ {oneTimeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* MRR Section */}
                {recurringItems.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Repeat className="h-3.5 w-3.5 text-emerald-500" />
                        Total MRR ({recurringItems.length} {recurringItems.length === 1 ? 'item' : 'itens'}):
                      </span>
                      <span className="font-semibold text-emerald-600">
                        R$ {recurringTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground pl-5">
                      <span>Contrato {contractMonths} meses:</span>
                      <span>R$ {recurringContractTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                {/* Item Discount if applicable */}
                {discountTotal > 0 && (
                  <div className="flex justify-between items-center text-sm text-red-600">
                    <span>Desconto nos Itens:</span>
                    <span className="font-medium">
                      - R$ {discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Payment Discount if applicable */}
                {paymentDiscountPercent > 0 && oneTimeTotal > 0 && (
                  <div className="flex justify-between items-center text-sm text-red-600">
                    <span>Desconto Condição Pagto ({paymentDiscountPercent}%):</span>
                    <span className="font-medium">
                      - R$ {paymentDiscountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base">Valor Total da Proposta:</span>
                    <span className="font-bold text-lg text-primary">
                      R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {recurringItems.length > 0 && oneTimeItems.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      (Avulso + MRR × {contractMonths} meses)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SortableRowProps {
  item: ProposalItem;
  index: number;
  totalItems: number;
  measurementUnits: { id: string; name: string; abbreviation: string; is_default?: boolean }[];
  onUpdate: (id: string, updates: Partial<ProposalItem>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

function SortableRow({ item, index, totalItems, measurementUnits, onUpdate, onDelete, onMove }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Fallback for legacy items without billing_type
  const billingType = item.billing_type || 'one_time';
  const isRecurring = billingType === 'recurring';
  const isPointDay = billingType === 'point_day';

  return (
    <TableRow ref={setNodeRef} style={style} className="group align-top">
      <TableCell className="pt-3">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={index === 0}
              onClick={() => onMove(index, 'up')}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={index === totalItems - 1}
              onClick={() => onMove(index, 'down')}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Input
            value={item.name}
            onChange={(e) => onUpdate(item.id!, { name: e.target.value })}
            className="h-8 text-sm font-medium"
            placeholder="Nome do item"
          />
          <MiniRichTextEditor
            value={item.description || ''}
            onChange={(value) => onUpdate(item.id!, { description: value })}
            placeholder="Descrição do item..."
          />
        </div>
      </TableCell>
      <TableCell className="pt-3">
        <Badge
          variant={isRecurring || isPointDay ? 'default' : 'secondary'}
          className={
            isRecurring
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : isPointDay
                ? 'bg-sky-500 hover:bg-sky-600 text-white'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }
        >
          {isRecurring ? (
            <><Repeat className="h-3 w-3 mr-1" />MRR</>
          ) : isPointDay ? (
            <><Zap className="h-3 w-3 mr-1" />Ponto-dia</>
          ) : (
            <><Zap className="h-3 w-3 mr-1" />Avulso</>
          )}
        </Badge>
      </TableCell>
      {isPointDay ? (
        <>
          <TableCell className="pt-3" colSpan={2}>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                step="1"
                defaultValue={item.quantity_points ?? 1}
                onBlur={(e) => {
                  const num = Math.max(1, parseInt(e.target.value || '1', 10));
                  onUpdate(item.id!, { quantity_points: num });
                }}
                className="w-16 h-8 text-sm"
                title="Pontos"
              />
              <span className="text-xs text-muted-foreground">pts ×</span>
              <Input
                type="number"
                min="1"
                step="1"
                defaultValue={item.billing_days ?? 1}
                onBlur={(e) => {
                  const num = Math.max(1, parseInt(e.target.value || '1', 10));
                  onUpdate(item.id!, { billing_days: num });
                }}
                className="w-16 h-8 text-sm"
                title="Diárias"
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </TableCell>
          <TableCell className="pt-3" />
          <TableCell className="pt-3">
            <div className="flex flex-col">
              <Input
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.unit_price_point_day ?? item.unit_price ?? 0}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  onUpdate(item.id!, {
                    unit_price_point_day: num >= 0 ? num : 0,
                    unit_price: num >= 0 ? num : 0,
                  });
                }}
                className="w-28 h-8 text-sm"
              />
              <span className="text-xs text-sky-600 mt-0.5">/ponto-dia</span>
            </div>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="pt-3">
            <Input
              type="number"
              min="1"
              step="0.01"
              defaultValue={item.quantity}
              onBlur={(e) => {
                const num = parseFloat(e.target.value);
                onUpdate(item.id!, { quantity: num > 0 ? num : 1 });
              }}
              className="w-20 h-8 text-sm"
            />
          </TableCell>
          <TableCell className="pt-3">
            <Select
              value={item.measurement_unit_id || ''}
              onValueChange={(value) => onUpdate(item.id!, { measurement_unit_id: value || undefined })}
            >
              <SelectTrigger className="w-20 h-8 text-sm">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                {measurementUnits.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.abbreviation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="pt-3">
            <Input
              type="number"
              min="0"
              step="0.01"
              defaultValue={item.unit_cost}
              onBlur={(e) => {
                const num = parseFloat(e.target.value);
                onUpdate(item.id!, { unit_cost: num >= 0 ? num : 0 });
              }}
              className="w-28 h-8 text-sm"
            />
          </TableCell>
          <TableCell className="pt-3">
            <div className="flex flex-col">
              <Input
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.unit_price}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  onUpdate(item.id!, { unit_price: num >= 0 ? num : 0 });
                }}
                className="w-28 h-8 text-sm"
              />
              {isRecurring && (
                <span className="text-xs text-emerald-600 mt-0.5">/mês</span>
              )}
            </div>
          </TableCell>
        </>
      )}
      <TableCell className="pt-3">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.1"
          defaultValue={item.discount_percent}
          onBlur={(e) => {
            const num = parseFloat(e.target.value);
            onUpdate(item.id!, { discount_percent: num >= 0 ? num : 0 });
          }}
          className="w-20 h-8 text-sm"
        />
      </TableCell>
      <TableCell className="text-right font-semibold pt-3">
        <div className="flex flex-col items-end">
          <span>R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          {isRecurring && (
            <span className="text-xs text-emerald-600">/mês</span>
          )}
        </div>
      </TableCell>
      <TableCell className="pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item.id!)}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface AddItemFormProps {
  products: any[];
  measurementUnits: { id: string; name: string; abbreviation: string; is_default?: boolean }[];
  onAdd: (item: Partial<ProposalItem>) => void;
  onCancel: () => void;
}

function AddItemForm({ products, measurementUnits, onAdd, onCancel }: AddItemFormProps) {
  const [mode, setMode] = useState<'product' | 'custom'>('product');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Get default unit
  const defaultUnit = measurementUnits.find(u => u.is_default);
  
  const [customItem, setCustomItem] = useState<Partial<ProposalItem>>({
    name: '',
    description: '',
    quantity: 1,
    unit_cost: 0,
    markup_percent: 0,
    unit_price: 0,
    discount_percent: 0,
    measurement_unit_id: defaultUnit?.id,
    billing_type: 'one_time',
    counts_for_commission: true,
  });

  const handleSelectProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);

      const cost = product.cost || 0;
      const isRecurring = product.billing_type === 'recurring';
      const isPointDay = product.billing_type === 'point_day';
      const price = isRecurring && product.monthly_price
        ? product.monthly_price
        : isPointDay && product.default_unit_price_point_day
          ? product.default_unit_price_point_day
          : (product.price || 0);

      let markupPercent = 0;
      if (cost > 0 && price > cost) {
        markupPercent = ((price - cost) / cost) * 100;
      }

      let matchedUnitId = defaultUnit?.id;
      if (product.unit) {
        const matchingUnit = measurementUnits.find(u =>
          u.abbreviation.toLowerCase() === product.unit.toLowerCase() ||
          u.name.toLowerCase() === product.unit.toLowerCase()
        );
        if (matchingUnit) {
          matchedUnitId = matchingUnit.id;
        }
      }

      setCustomItem({
        product_id: productId,
        name: product.name,
        description: product.description || '',
        quantity: 1,
        unit_cost: cost,
        markup_percent: Number(markupPercent.toFixed(2)),
        unit_price: price,
        discount_percent: 0,
        image_url: product.image_url,
        measurement_unit_id: matchedUnitId,
        billing_type: product.billing_type || 'one_time',
        counts_for_commission: product.counts_for_commission ?? true,
        minimum_contract_months: product.minimum_contract_months || 1,
        quantity_points: isPointDay ? (product.default_quantity_points ?? 1) : undefined,
        billing_days: isPointDay ? (product.default_billing_days ?? 1) : undefined,
        unit_price_point_day: isPointDay ? (product.default_unit_price_point_day ?? price) : undefined,
      });
    }
  };

  const handleSubmit = () => {
    if (!customItem.name) return;
    onAdd(customItem);
  };

  const isRecurring = customItem.billing_type === 'recurring';
  const isPointDay = customItem.billing_type === 'point_day';
  // Calculate preview total
  const previewTotal = isPointDay
    ? Math.max(1, customItem.quantity_points || 1) *
      Math.max(1, customItem.billing_days || 1) *
      (customItem.unit_price_point_day || 0) *
      (1 - (customItem.discount_percent || 0) / 100)
    : (customItem.unit_price || 0) * (customItem.quantity || 1) * (1 - (customItem.discount_percent || 0) / 100);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'product' ? 'default' : 'outline'}
          onClick={() => setMode('product')}
          className="flex-1"
        >
          Selecionar Produto
        </Button>
        <Button
          type="button"
          variant={mode === 'custom' ? 'default' : 'outline'}
          onClick={() => setMode('custom')}
          className="flex-1"
        >
          Item Customizado
        </Button>
      </div>

      {mode === 'product' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={selectedProductId} onValueChange={handleSelectProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex items-center gap-2">
                      {product.billing_type === 'recurring' && (
                        <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">MRR</Badge>
                      )}
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.billing_type === 'recurring' 
                            ? `R$ ${(product.monthly_price || product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
                            : `R$ ${(product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          }
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Item *</Label>
            <Input
              value={customItem.name}
              onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
              placeholder="Ex: Consultoria especializada"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={customItem.description || ''}
              onChange={(e) => setCustomItem({ ...customItem, description: e.target.value })}
              placeholder="Descreva o item..."
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Billing Type Selection - Visual Feedback */}
      {(selectedProductId || mode === 'custom') && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <Label>Tipo de Cobrança</Label>
          <div className="flex gap-3">
            <label className={`flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-lg border transition-colors ${
              customItem.billing_type === 'one_time' 
                ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700' 
                : 'hover:bg-muted'
            }`}>
              <input
                type="radio"
                name="item_billing_type"
                value="one_time"
                checked={customItem.billing_type === 'one_time'}
                onChange={() => setCustomItem(prev => ({ ...prev, billing_type: 'one_time' }))}
                className="h-4 w-4"
              />
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <div>
                  <span className="text-sm font-medium">Avulso</span>
                  <p className="text-xs text-muted-foreground">Cobrança única</p>
                </div>
              </div>
            </label>
            <label className={`flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-lg border transition-colors ${
              customItem.billing_type === 'recurring' 
                ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700' 
                : 'hover:bg-muted'
            }`}>
              <input
                type="radio"
                name="item_billing_type"
                value="recurring"
                checked={customItem.billing_type === 'recurring'}
                onChange={() => setCustomItem(prev => ({ ...prev, billing_type: 'recurring' }))}
                className="h-4 w-4"
              />
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-emerald-500" />
                <div>
                  <span className="text-sm font-medium">Recorrente (MRR)</span>
                  <p className="text-xs text-muted-foreground">Mensalidade</p>
                </div>
              </div>
            </label>
            <label className={`flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-lg border transition-colors ${
              customItem.billing_type === 'point_day'
                ? 'bg-sky-50 border-sky-300 dark:bg-sky-950/30 dark:border-sky-700'
                : 'hover:bg-muted'
            }`}>
              <input
                type="radio"
                name="item_billing_type"
                value="point_day"
                checked={customItem.billing_type === 'point_day'}
                onChange={() => setCustomItem(prev => ({
                  ...prev,
                  billing_type: 'point_day',
                  quantity_points: prev.quantity_points ?? 1,
                  billing_days: prev.billing_days ?? 1,
                  unit_price_point_day: prev.unit_price_point_day ?? prev.unit_price ?? 0,
                }))}
                className="h-4 w-4"
              />
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-sky-500" />
                <div>
                  <span className="text-sm font-medium">Ponto-dia</span>
                  <p className="text-xs text-muted-foreground">Pontos × diárias</p>
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Point-day specific fields */}
      {(selectedProductId || mode === 'custom') && isPointDay && (
        <div className="border rounded-lg p-4 space-y-4 bg-sky-50/50 dark:bg-sky-950/20">
          <Label className="text-sm font-semibold">Cobrança por Ponto-dia</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Pontos</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={customItem.quantity_points ?? 1}
                onChange={(e) => {
                  const num = Math.max(1, parseInt(e.target.value || '1', 10));
                  setCustomItem(prev => ({ ...prev, quantity_points: num }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Diárias</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={customItem.billing_days ?? 1}
                onChange={(e) => {
                  const num = Math.max(1, parseInt(e.target.value || '1', 10));
                  setCustomItem(prev => ({ ...prev, billing_days: num }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço / ponto-dia (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                defaultValue={customItem.unit_price_point_day ?? 0}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value) || 0;
                  setCustomItem(prev => ({ ...prev, unit_price_point_day: num, unit_price: num }));
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {(customItem.quantity_points ?? 1)} pts × {(customItem.billing_days ?? 1)} diárias × R${' '}
            {(customItem.unit_price_point_day ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={customItem.discount_percent}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value) || 0;
                  setCustomItem(prev => ({ ...prev, discount_percent: num }));
                }}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full p-3 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-right">
                <div className="text-xs text-muted-foreground">Total do item</div>
                <div className="text-lg font-bold text-sky-700 dark:text-sky-300">
                  R$ {previewTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Common fields */}
      {(selectedProductId || mode === 'custom') && !isPointDay && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                step={1}
                defaultValue={customItem.quantity}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  setCustomItem(prev => ({ ...prev, quantity: num > 0 ? num : 1 }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select 
                value={customItem.measurement_unit_id || ''} 
                onValueChange={(value) => setCustomItem(prev => ({ ...prev, measurement_unit_id: value || undefined }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {measurementUnits.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.abbreviation} - {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                defaultValue={customItem.unit_cost}
                onBlur={(e) => {
                  const newCost = parseFloat(e.target.value) || 0;
                  const newPrice = newCost * (1 + (customItem.markup_percent || 0) / 100);
                  setCustomItem(prev => ({ ...prev, unit_cost: newCost, unit_price: Number(newPrice.toFixed(2)) }));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Markup (%)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                defaultValue={customItem.markup_percent}
                onBlur={(e) => {
                  const newMarkup = parseFloat(e.target.value) || 0;
                  const newPrice = (customItem.unit_cost || 0) * (1 + newMarkup / 100);
                  setCustomItem(prev => ({ ...prev, markup_percent: newMarkup, unit_price: Number(newPrice.toFixed(2)) }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço Unitário (R$){isRecurring && <span className="text-emerald-600">/mês</span>}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                defaultValue={customItem.unit_price}
                onBlur={(e) => {
                  const newPrice = parseFloat(e.target.value) || 0;
                  let newMarkup = 0;
                  if ((customItem.unit_cost || 0) > 0) {
                    newMarkup = ((newPrice - (customItem.unit_cost || 0)) / (customItem.unit_cost || 1)) * 100;
                  }
                  setCustomItem(prev => ({ ...prev, unit_price: newPrice, markup_percent: Number(newMarkup.toFixed(2)) }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={customItem.discount_percent}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value) || 0;
                  setCustomItem(prev => ({ ...prev, discount_percent: num }));
                }}
              />
            </div>
          </div>

          {/* Preview */}
          <div className={`p-4 rounded-lg space-y-2 ${isRecurring ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted'}`}>
            <div className="flex justify-between text-sm">
              <span>Preço Unitário{isRecurring && '/mês'}:</span>
              <span className="font-medium">
                R$ {(customItem.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {(customItem.discount_percent || 0) > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Desconto ({customItem.discount_percent}%):</span>
                <span className="font-medium">
                  - R$ {((customItem.unit_price || 0) * (customItem.quantity || 1) * ((customItem.discount_percent || 0) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total do Item{isRecurring && '/mês'}:</span>
              <span className={isRecurring ? 'text-emerald-600' : ''}>
                R$ {previewTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {isRecurring && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>Contrato 12 meses:</span>
                <span>R$ {(previewTotal * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button 
          type="button" 
          onClick={handleSubmit} 
          className="flex-1"
          disabled={!customItem.name}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
