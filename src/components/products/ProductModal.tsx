import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import { createProduct, updateProduct, type Product } from '@/services/crm/products';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useMeasurementUnits } from '@/hooks/useMeasurementUnits';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { ImageUpload } from './ImageUpload';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Repeat, Zap, TrendingUp } from 'lucide-react';
import { ProductBOMEditor } from './ProductBOMEditor';
import { replaceProductBomItems, type ProductBomItemInput } from '@/services/supabase/product-bom';

// Helper para tratar NaN/vazio como undefined
const parseNumber = (val: unknown) => {
  if (val === '' || val === undefined || val === null) return undefined;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
};

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['produto', 'servico']),
  code: z.string().optional(),
  reference: z.string().optional(),
  category_id: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  cost: z.preprocess(parseNumber, z.number().min(0, 'Custo deve ser positivo').optional()),
  price: z.preprocess(parseNumber, z.number().min(0, 'Preço deve ser positivo').optional()),
  ipi_percent: z.preprocess(parseNumber, z.number().min(0).max(100).optional()),
  image_url: z.string().url().optional().or(z.literal('')),
  active: z.boolean(),
  // Billing type fields
  billing_type: z.enum(['one_time', 'recurring', 'point_day']),
  billing_cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).optional(),
  monthly_price: z.preprocess(parseNumber, z.number().min(0, 'Preço mensal deve ser positivo').optional()),
  minimum_contract_months: z.preprocess(parseNumber, z.number().int().min(1).optional()),
  // Point-day fields
  default_unit_price_point_day: z.preprocess(parseNumber, z.number().min(0).optional()),
  default_billing_days: z.preprocess(parseNumber, z.number().int().min(1).optional()),
  default_quantity_points: z.preprocess(parseNumber, z.number().int().min(1).optional()),
  // Commission tracking
  counts_for_commission: z.boolean(),
}).refine(
  (data) => data.billing_type !== 'recurring' || (data.monthly_price !== undefined && data.monthly_price > 0),
  {
    message: 'Preço mensal é obrigatório para produtos recorrentes',
    path: ['monthly_price'],
  }
).refine(
  (data) => data.billing_type !== 'point_day' || (data.default_unit_price_point_day !== undefined && data.default_unit_price_point_day > 0),
  {
    message: 'Preço por ponto-dia é obrigatório',
    path: ['default_unit_price_point_day'],
  }
);

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
  const [bomItems, setBomItems] = useState<ProductBomItemInput[]>([]);

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
      billing_type: 'one_time',
      billing_cycle: 'monthly',
      monthly_price: undefined,
      minimum_contract_months: 12,
      default_unit_price_point_day: undefined,
      default_billing_days: 1,
      default_quantity_points: 1,
      counts_for_commission: true,
    },
  });

  const billingType = form.watch('billing_type');
  const cost = form.watch('cost');
  const price = form.watch('price');
  const monthlyPrice = form.watch('monthly_price');
  const minimumContractMonths = form.watch('minimum_contract_months') || 12;

  // Calculate margin based on billing type
  const effectivePrice = billingType === 'recurring' ? monthlyPrice : price;
  const margin = cost && effectivePrice && cost > 0 
    ? ((effectivePrice - cost) / cost * 100).toFixed(1) 
    : '0.0';

  // Calculate contract total for recurring
  const contractTotal = (monthlyPrice || 0) * minimumContractMonths;

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
        billing_type: (product as any)?.billing_type || 'one_time',
        billing_cycle: (product as any)?.billing_cycle || 'monthly',
        monthly_price: (product as any)?.monthly_price || undefined,
        minimum_contract_months: (product as any)?.minimum_contract_months || 12,
        default_unit_price_point_day: (product as any)?.default_unit_price_point_day ?? undefined,
        default_billing_days: (product as any)?.default_billing_days ?? 1,
        default_quantity_points: (product as any)?.default_quantity_points ?? 1,
        counts_for_commission: (product as any)?.counts_for_commission ?? true,
      });
      setImagePreview(product?.image_url || '');
      if (!product) setBomItems([]);
    } else {
      form.reset();
      setImagePreview('');
      setBomItems([]);
    }
  }, [open, product, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      // For recurring products, use monthly_price as the main price
      const payload = {
        ...data,
        category_id: data.category_id || null,
        image_url: data.image_url || null,
        // For recurring use monthly_price; for point_day use default_unit_price_point_day
        price:
          data.billing_type === 'recurring'
            ? data.monthly_price
            : data.billing_type === 'point_day'
              ? data.default_unit_price_point_day
              : data.price,
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
                <Label>Descrição</Label>
                <RichTextEditor
                  value={form.watch('description') || ''}
                  onChange={(value) => form.setValue('description', value)}
                  placeholder="Descreva o produto ou serviço..."
                  minHeight="120px"
                />
              </div>

              {/* SEÇÃO UNIFICADA: Configuração de Preço */}
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    💰 Configuração de Preço
                  </h4>
                  {billingType === 'recurring' && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600">
                      <Repeat className="h-3 w-3 mr-1" />
                      MRR
                    </Badge>
                  )}
                </div>
                
                {/* Billing Type Selection - TOP */}
                <div className="flex gap-4 p-3 bg-background rounded-lg border">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 p-2 rounded-lg hover:bg-muted transition-colors">
                    <input
                      type="radio"
                      name="billing_type"
                      value="one_time"
                      checked={billingType === 'one_time'}
                      onChange={() => form.setValue('billing_type', 'one_time')}
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <div>
                        <span className="font-medium text-sm">Avulso</span>
                        <p className="text-xs text-muted-foreground">Cobrança única</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer flex-1 p-2 rounded-lg hover:bg-muted transition-colors">
                    <input
                      type="radio"
                      name="billing_type"
                      value="recurring"
                      checked={billingType === 'recurring'}
                      onChange={() => form.setValue('billing_type', 'recurring')}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-emerald-500" />
                      <div>
                        <span className="font-medium text-sm">Recorrente (MRR)</span>
                        <p className="text-xs text-muted-foreground">Mensalidade</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer flex-1 p-2 rounded-lg hover:bg-muted transition-colors">
                    <input
                      type="radio"
                      name="billing_type"
                      value="point_day"
                      checked={billingType === 'point_day'}
                      onChange={() => form.setValue('billing_type', 'point_day')}
                      className="h-4 w-4 accent-sky-500"
                    />
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-sky-500" />
                      <div>
                        <span className="font-medium text-sm">Ponto-dia</span>
                        <p className="text-xs text-muted-foreground">Pontos × diárias</p>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Conditional Fields Based on Billing Type */}
                {billingType === 'point_day' ? (
                  /* PONTO-DIA FIELDS */
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="default_quantity_points">Pontos padrão</Label>
                        <Input
                          id="default_quantity_points"
                          type="number"
                          min="1"
                          step="1"
                          {...form.register('default_quantity_points')}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="default_billing_days">Diárias padrão</Label>
                        <Input
                          id="default_billing_days"
                          type="number"
                          min="1"
                          step="1"
                          {...form.register('default_billing_days')}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="default_unit_price_point_day">Preço por ponto-dia (R$) *</Label>
                        <Input
                          id="default_unit_price_point_day"
                          type="number"
                          min="0"
                          step="0.01"
                          {...form.register('default_unit_price_point_day')}
                          placeholder="0,00"
                          className={form.formState.errors.default_unit_price_point_day ? 'border-destructive' : ''}
                        />
                        {form.formState.errors.default_unit_price_point_day && (
                          <p className="text-sm text-destructive mt-1">
                            {form.formState.errors.default_unit_price_point_day.message as string}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 text-sm">
                      <strong>Cálculo:</strong> pontos × diárias × preço por ponto-dia.
                      Estoque reservado considera apenas a quantidade de pontos durante o período do evento.
                    </div>
                  </div>
                ) : billingType === 'one_time' ? (
                  /* AVULSO FIELDS */
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
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
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="cost">Custo (R$)</Label>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          {...form.register('cost')}
                          placeholder="0,00"
                        />
                      </div>

                      <div>
                        <Label htmlFor="price">Preço de Venda (R$)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          {...form.register('price')}
                          placeholder="0,00"
                        />
                      </div>

                      <div>
                        <Label htmlFor="ipi_percent">IPI (%)</Label>
                        <Input
                          id="ipi_percent"
                          type="number"
                          step="0.01"
                          {...form.register('ipi_percent')}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Margin Display */}
                    <div className="flex items-center gap-2 p-2 bg-background rounded border">
                      <TrendingUp className={`h-4 w-4 ${parseFloat(margin) > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm text-muted-foreground">Margem:</span>
                      <span className={`font-semibold ${parseFloat(margin) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {margin}%
                      </span>
                    </div>
                  </div>
                ) : (
                  /* RECORRENTE FIELDS */
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
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
                                <SelectItem value="user">Usuário</SelectItem>
                                <SelectItem value="un">Unidade (un)</SelectItem>
                                <SelectItem value="mes">Mês</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="cost">Custo/Un. (R$)</Label>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          {...form.register('cost')}
                          placeholder="0,00"
                        />
                      </div>

                      <div>
                        <Label htmlFor="ipi_percent">IPI (%)</Label>
                        <Input
                          id="ipi_percent"
                          type="number"
                          step="0.01"
                          {...form.register('ipi_percent')}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="billing_cycle">Ciclo</Label>
                        <Select
                          value={form.watch('billing_cycle') || 'monthly'}
                          onValueChange={(value) => form.setValue('billing_cycle', value as any)}
                        >
                          <SelectTrigger id="billing_cycle">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="semiannual">Semestral</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="monthly_price">Preço Mensal/Un. (R$) *</Label>
                        <Input
                          id="monthly_price"
                          type="number"
                          step="0.01"
                          {...form.register('monthly_price')}
                          placeholder="0,00"
                          className={form.formState.errors.monthly_price ? 'border-destructive' : ''}
                        />
                        {form.formState.errors.monthly_price && (
                          <p className="text-sm text-destructive mt-1">{form.formState.errors.monthly_price.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="minimum_contract_months">Contrato Mínimo</Label>
                        <Select
                          value={String(form.watch('minimum_contract_months') || 12)}
                          onValueChange={(value) => form.setValue('minimum_contract_months', parseInt(value))}
                        >
                          <SelectTrigger id="minimum_contract_months">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 mês</SelectItem>
                            <SelectItem value="3">3 meses</SelectItem>
                            <SelectItem value="6">6 meses</SelectItem>
                            <SelectItem value="12">12 meses</SelectItem>
                            <SelectItem value="24">24 meses</SelectItem>
                            <SelectItem value="36">36 meses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* MRR Summary Card */}
                    {(monthlyPrice || 0) > 0 && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Repeat className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                            Resumo do Contrato
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">MRR/Un.</p>
                            <p className="font-bold text-emerald-600">
                              R$ {(monthlyPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Contrato ({minimumContractMonths}m)</p>
                            <p className="font-bold">
                              R$ {contractTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Margem</p>
                            <p className={`font-bold ${parseFloat(margin) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                              {margin}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

              {/* Counts for Commission */}
              <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
                <div>
                  <Label>Contabiliza na Meta</Label>
                  <p className="text-sm text-muted-foreground">Este item é contabilizado nas metas e comissões dos vendedores</p>
                </div>
                <Switch
                  checked={form.watch('counts_for_commission')}
                  onCheckedChange={(checked) => form.setValue('counts_for_commission', checked)}
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
