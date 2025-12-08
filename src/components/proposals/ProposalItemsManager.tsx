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
import { Plus, Trash2, GripVertical, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { ProposalItem } from '@/services/crm/proposal-items';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { Textarea } from '@/components/ui/textarea';
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
import { CurrencyInput } from '@/components/ui/currency-input';

interface ProposalItemsManagerProps {
  items: ProposalItem[];
  onChange: (items: ProposalItem[]) => void;
}

// Calculate totals with direct unit_price support
function calculateItemTotalsLocal(item: Partial<ProposalItem>): Partial<ProposalItem> {
  const quantity = item.quantity || 1;
  const unitPrice = item.unit_price || 0;
  const discountPercent = item.discount_percent || 0;

  // Total = unit_price * quantity * (1 - discount%)
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

export function ProposalItemsManager({ items, onChange }: ProposalItemsManagerProps) {
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const { organization } = useCurrentOrganization();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch products
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
      quantity: newItem.quantity || 1,
      unit_cost: newItem.unit_cost || 0,
      markup_percent: newItem.markup_percent || 0,
      unit_price: itemWithCalculations.unit_price || 0,
      ipi_percent: 0,
      discount_percent: newItem.discount_percent || 0,
      total: itemWithCalculations.total || 0,
      product_id: newItem.product_id,
      image_url: newItem.image_url,
      characteristics: newItem.characteristics,
    };

    onChange([...items, item]);
    setAddProductModalOpen(false);
  };

  const handleUpdateItem = (id: string, updates: Partial<ProposalItem>) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, ...updates };
        
        // Recalculate markup as INFORMATIVE only (never recalculate unit_price from markup)
        // If unit_price or unit_cost changed, recalculate markup for display purposes
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

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => {
    const itemSubtotal = item.unit_price * item.quantity;
    const itemDiscount = itemSubtotal * (item.discount_percent / 100);
    return sum + itemDiscount;
  }, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Item</DialogTitle>
            </DialogHeader>
            <AddItemForm 
              products={products || []} 
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
                      <TableHead className="w-20">Qtd</TableHead>
                      <TableHead className="w-28">Custo Un.</TableHead>
                      <TableHead className="w-28">Preço Un.</TableHead>
                      <TableHead className="w-24">Desc. %</TableHead>
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

            {/* Totalizadores */}
            <div className="flex justify-end">
              <div className="w-80 space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">
                    R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto Total:</span>
                    <span className="font-medium">
                      - R$ {discountTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Valor Total da Proposta:</span>
                  <span className="text-primary">
                    R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
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
  onUpdate: (id: string, updates: Partial<ProposalItem>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

function SortableRow({ item, index, totalItems, onUpdate, onDelete, onMove }: SortableRowProps) {
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
      </TableCell>
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
          className="w-24 h-8 text-sm"
        />
      </TableCell>
      <TableCell className="text-right font-semibold pt-3">
        R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
  onAdd: (item: Partial<ProposalItem>) => void;
  onCancel: () => void;
}

function AddItemForm({ products, onAdd, onCancel }: AddItemFormProps) {
  const [mode, setMode] = useState<'product' | 'custom'>('product');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customItem, setCustomItem] = useState<Partial<ProposalItem>>({
    name: '',
    description: '',
    quantity: 1,
    unit_cost: 0,
    markup_percent: 0,
    unit_price: 0,
    discount_percent: 0,
  });

  const handleSelectProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      
      // Use product.cost as unit_cost
      // Use product.price DIRECTLY as unit_price (not calculated)
      const cost = product.cost || 0;
      const price = product.price || 0;
      
      // Calculate markup for display only
      let markupPercent = 0;
      if (cost > 0 && price > cost) {
        markupPercent = ((price - cost) / cost) * 100;
      }
      
      setCustomItem({
        product_id: productId,
        name: product.name,
        description: product.description || '', // Preserve HTML formatting from product
        quantity: 1,
        unit_cost: cost,
        markup_percent: Number(markupPercent.toFixed(2)),
        unit_price: price, // USE PRICE DIRECTLY from products table
        discount_percent: 0,
        image_url: product.image_url,
      });
    }
  };

  const handleSubmit = () => {
    if (!customItem.name) return;
    onAdd(customItem);
  };

  // Calculate preview total
  const previewTotal = (customItem.unit_price || 0) * (customItem.quantity || 1) * (1 - (customItem.discount_percent || 0) / 100);

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
                    <div className="flex flex-col">
                      <span>{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Custo: R$ {(product.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                        Preço: R$ {(product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
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

      {/* Common fields */}
      {(selectedProductId || mode === 'custom') && (
        <>
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Preço Unitário (R$)</Label>
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
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Preço Unitário:</span>
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
              <span>Total do Item:</span>
              <span>
                R$ {previewTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
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
