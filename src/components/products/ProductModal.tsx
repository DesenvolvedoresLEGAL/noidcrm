import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct, updateProduct, type Product } from '@/services/supabase/products';

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  code: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
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
  const isEditing = !!product;

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      code: product?.code || '',
      description: product?.description || '',
      price: product?.price?.toString() || '',
      active: product?.active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        ...data,
        price: data.price ? parseFloat(data.price) : undefined,
      };

      if (isEditing) {
        return updateProduct(product.id, payload);
      }
      return createProduct(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: isEditing ? 'Produto atualizado' : 'Produto criado',
        description: isEditing
          ? 'O produto foi atualizado com sucesso.'
          : 'O produto foi criado com sucesso.',
      });
      onOpenChange(false);
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

  const activeValue = watch('active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input id="code" {...register('code')} placeholder="Ex: PROD-001" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" {...register('description')} rows={4} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Preço Sugerido</Label>
            <Input
              id="price"
              {...register('price')}
              type="number"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={activeValue}
              onCheckedChange={(checked) => setValue('active', checked)}
            />
            <Label htmlFor="active" className="cursor-pointer">
              Produto ativo
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
