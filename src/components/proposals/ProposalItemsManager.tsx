import { useState, useEffect } from 'react';
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
import { Plus, Trash2, GripVertical, Package } from 'lucide-react';
import { ProposalItem, calculateItemTotals } from '@/services/crm/proposal-items';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { Textarea } from '@/components/ui/textarea';

interface ProposalItemsManagerProps {
  items: ProposalItem[];
  onChange: (items: ProposalItem[]) => void;
}

export function ProposalItemsManager({ items, onChange }: ProposalItemsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const { organization } = useCurrentOrganization();

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
    const itemWithCalculations = calculateItemTotals({
      ...newItem,
      order_index: items.length,
    } as ProposalItem);

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
      ipi_percent: newItem.ipi_percent || 0,
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
        const withCalculations = calculateItemTotals(updatedItem);
        return { ...updatedItem, ...withCalculations };
      }
      return item;
    });
    onChange(updatedItems);
  };

  const handleDeleteItem = (id: string) => {
    const filteredItems = items.filter(item => item.id !== id);
    // Reindex
    const reindexed = filteredItems.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    onChange(reindexed);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    
    const reindexed = reordered.map((item, index) => ({
      ...item,
      order_index: index,
    }));
    onChange(reindexed);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Itens da Proposta (Produtos & Serviços)</CardTitle>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    <TableHead className="w-24">Custo Un.</TableHead>
                    <TableHead className="w-20">Markup %</TableHead>
                    <TableHead className="w-24">Preço Un.</TableHead>
                    <TableHead className="w-20">IPI %</TableHead>
                    <TableHead className="w-20">Desc. %</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} className="group">
                      <TableCell>
                        <button
                          className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id!, { quantity: parseFloat(e.target.value) || 1 })}
                          className="w-20 h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => handleUpdateItem(item.id!, { unit_cost: parseFloat(e.target.value) || 0 })}
                          className="w-24 h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="1000"
                          step="0.1"
                          value={item.markup_percent}
                          onChange={(e) => handleUpdateItem(item.id!, { markup_percent: parseFloat(e.target.value) || 0 })}
                          className="w-20 h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.ipi_percent}
                          onChange={(e) => handleUpdateItem(item.id!, { ipi_percent: parseFloat(e.target.value) || 0 })}
                          className="w-20 h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discount_percent}
                          onChange={(e) => handleUpdateItem(item.id!, { discount_percent: parseFloat(e.target.value) || 0 })}
                          className="w-20 h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id!)}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>
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
    ipi_percent: 0,
    discount_percent: 0,
  });

  const handleSelectProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      setCustomItem({
        product_id: productId,
        name: product.name,
        description: product.description,
        quantity: 1,
        unit_cost: product.price || 0,
        markup_percent: 0,
        ipi_percent: 0,
        discount_percent: 0,
      });
    }
  };

  const handleSubmit = () => {
    if (!customItem.name) return;
    onAdd(customItem);
  };

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
                    {product.name} - R$ {(product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                min="1"
                step="0.01"
                value={customItem.quantity}
                onChange={(e) => setCustomItem({ ...customItem, quantity: parseFloat(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={customItem.unit_cost}
                onChange={(e) => setCustomItem({ ...customItem, unit_cost: parseFloat(e.target.value) || 0 })}
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
                value={customItem.markup_percent}
                onChange={(e) => setCustomItem({ ...customItem, markup_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>IPI (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={customItem.ipi_percent}
                onChange={(e) => setCustomItem({ ...customItem, ipi_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={customItem.discount_percent}
                onChange={(e) => setCustomItem({ ...customItem, discount_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Preço Unitário:</span>
              <span className="font-medium">
                R$ {((customItem.unit_cost || 0) * (1 + (customItem.markup_percent || 0) / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total do Item:</span>
              <span>
                R$ {calculateItemTotals(customItem as ProposalItem).total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
          onClick={handleSubmit} 
          disabled={!customItem.name}
          className="flex-1"
        >
          Adicionar Item
        </Button>
      </div>
    </div>
  );
}
