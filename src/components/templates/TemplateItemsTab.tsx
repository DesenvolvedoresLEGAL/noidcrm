import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listProducts, Product } from '@/services/crm/products';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TemplateItem {
  product_id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
}

interface TemplateItemsTabProps {
  items: TemplateItem[];
  onChange: (items: TemplateItem[]) => void;
}

export function TemplateItemsTab({ items, onChange }: TemplateItemsTabProps) {
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => listProducts(),
  });

  const products: Product[] = productsData?.data || [];

  const addItem = () => {
    onChange([
      ...items,
      { name: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const updateItem = (index: number, field: keyof TemplateItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updated = [...items];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        name: product.name,
        description: product.description,
        unit_price: product.price || 0,
      };
      onChange(updated);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Itens Padrão</CardTitle>
              <CardDescription>
                Produtos e serviços que serão pré-carregados ao usar este template
              </CardDescription>
            </div>
          </div>
          <Button onClick={addItem} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum item padrão configurado
            </p>
            <Button onClick={addItem} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Item
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Produto/Serviço</Label>
                    <Select
                      value={item.product_id || 'custom'}
                      onValueChange={(value) => {
                        if (value === 'custom') {
                          updateItem(index, 'product_id', undefined);
                        } else {
                          selectProduct(index, value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione ou digite" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Item Personalizado</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.price || 0)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!item.product_id && (
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        placeholder="Nome do item"
                        className="mt-2"
                      />
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Preço Unitário</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                    />
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? 'item' : 'itens'} configurados
              </span>
              <span className="font-semibold">
                Total: {formatCurrency(items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
