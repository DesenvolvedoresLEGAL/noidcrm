import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { createProduct, updateProduct, type Product } from '@/services/crm/products';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useMeasurementUnits } from '@/hooks/useMeasurementUnits';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { ImageUpload } from './ImageUpload';
import { useState, useEffect } from 'react';

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['produto', 'servico']),
  code: z.string().optional(),
  reference: z.string().optional(),
  category_id: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  cost: z.number().min(0, 'Custo deve ser positivo').optional(),
  price: z.number().min(0, 'Preço deve ser positivo').optional(),
  ipi_percent: z.number().min(0).max(100).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}

export function ProductModal({ open, onOpenChange, product }: ProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories } = useProductCategories();
  const { units } = useMeasurementUnits();
  const { organization } = useCurrentOrganization();
  const [imagePreview, setImagePreview] = useState<string>('');

  // Get default unit abbreviation
  const defaultUnit = units.find(u => u.is_default)?.abbreviation || 'un';

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      type: 'produto',
      code: '',
      reference: '',
      category_id: '',
      description: '',
      unit: defaultUnit,
      cost: undefined,
      price: undefined,
      ipi_percent: 0,
      image_url: '',
      active: true,
    },
  });

  // Reset form when modal opens or product changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: product?.name || '',
        type: product?.type || 'produto',
        code: product?.code || '',
        reference: product?.reference || '',
        category_id: product?.category_id || '',
        description: product?.description || '',
        unit: product?.unit || defaultUnit,
        cost: product?.cost || undefined,
        price: product?.price || undefined,
        ipi_percent: product?.ipi_percent || 0,
        image_url: product?.image_url || '',
        active: product?.active ?? true,
      });
      setImagePreview(product?.image_url || '');
    } else {
      // Clear form when modal closes
      form.reset();
      setImagePreview('');
    }
  }, [open, product, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        ...data,
        category_id: data.category_id || null,
        image_url: data.image_url || null,
      };

      if (product) {
        return updateProduct(product.id, payload);
      }
      return createProduct(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: product ? 'Produto atualizado' : 'Produto criado',
        description: 'Operação realizada com sucesso.',
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data);
  };

  const handleImageUrlChange = (url: string) => {
    form.setValue('image_url', url);
    setImagePreview(url);
  };

  const cost = form.watch('cost');
  const price = form.watch('price');
  const margin = cost && price && cost > 0 ? ((price - cost) / cost * 100).toFixed(1) : '0.0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto/Serviço' : 'Novo Produto/Serviço'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1: Imagem */}
            <div className="space-y-4">
              <Label>Imagem do Produto</Label>
              <ImageUpload
                value={imagePreview}
                onChange={handleImageUrlChange}
                organizationId={organization?.id || ''}
              />
            </div>

            {/* Coluna 2: Informações Básicas */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={form.watch('type')}
                    onValueChange={(value) => form.setValue('type', value as 'produto' | 'servico')}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produto">Produto</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category_id">Categoria (opcional)</Label>
                  <Select
                    value={form.watch('category_id') || undefined}
                    onValueChange={(value) => form.setValue('category_id', value)}
                  >
                    <SelectTrigger id="category_id">
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input id="code" {...form.register('code')} placeholder="Ex: PROD-001" />
                </div>
                <div>
                  <Label htmlFor="reference">Referência/SKU</Label>
                  <Input id="reference" {...form.register('reference')} placeholder="Ex: REF-ABC" />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" {...form.register('description')} rows={3} />
              </div>

              {/* Seção de Valores */}
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-semibold text-sm">Valores & Tributação</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="unit">Unidade *</Label>
                    <Select
                      value={form.watch('unit')}
                      onValueChange={(value) => form.setValue('unit', value)}
                    >
                      <SelectTrigger id="unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.length > 0 ? (
                          units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.abbreviation}>
                              {unit.name} ({unit.abbreviation})
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="un">Unidade (un)</SelectItem>
                            <SelectItem value="hr">Hora (hr)</SelectItem>
                            <SelectItem value="dia">Dia</SelectItem>
                            <SelectItem value="mes">Mês</SelectItem>
                            <SelectItem value="kg">Quilograma (kg)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cost">Custo</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      {...form.register('cost', { valueAsNumber: true })}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ipi_percent">IPI (%)</Label>
                    <Input
                      id="ipi_percent"
                      type="number"
                      step="0.01"
                      {...form.register('ipi_percent', { valueAsNumber: true })}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Preço de Venda</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      {...form.register('price', { valueAsNumber: true })}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div>
                    <Label>Margem Calculada</Label>
                    <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                      <span className={`font-semibold ${parseFloat(margin) > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {margin}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
                <div>
                  <Label>Status</Label>
                  <p className="text-sm text-muted-foreground">Produto ativo no catálogo</p>
                </div>
                <Switch
                  checked={form.watch('active')}
                  onCheckedChange={(checked) => form.setValue('active', checked)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : product ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
