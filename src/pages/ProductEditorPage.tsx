import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, Repeat, Zap, TrendingUp, Save, Loader2 } from 'lucide-react';

import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

import { ImageUpload } from '@/components/products/ImageUpload';
import { ProductBOMEditor } from '@/components/products/ProductBOMEditor';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useMeasurementUnits } from '@/hooks/useMeasurementUnits';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import {
  createProduct,
  updateProduct,
  getProduct,
  type Product,
} from '@/services/supabase/products';
import {
  replaceProductBomItems,
  type ProductBomItemInput,
} from '@/services/supabase/product-bom';
import { computeMargin, type BillingType } from '@/lib/products/margin';
import { formatCurrencyBR } from '@/lib/i18n';

const parseNumber = (val: unknown) => {
  if (val === '' || val === undefined || val === null) return undefined;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
};

const productSchema = z
  .object({
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
    billing_type: z.enum(['one_time', 'recurring', 'point_day']),
    billing_cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).optional(),
    monthly_price: z.preprocess(parseNumber, z.number().min(0).optional()),
    minimum_contract_months: z.preprocess(parseNumber, z.number().int().min(1).optional()),
    default_unit_price_point_day: z.preprocess(parseNumber, z.number().min(0).optional()),
    default_billing_days: z.preprocess(parseNumber, z.number().int().min(1).optional()),
    default_quantity_points: z.preprocess(parseNumber, z.number().int().min(1).optional()),
    counts_for_commission: z.boolean(),
  })
  .refine(
    (d) =>
      d.billing_type !== 'recurring' ||
      (d.monthly_price !== undefined && d.monthly_price > 0),
    { message: 'Preço mensal é obrigatório', path: ['monthly_price'] },
  )
  .refine(
    (d) =>
      d.billing_type !== 'point_day' ||
      (d.default_unit_price_point_day !== undefined &&
        d.default_unit_price_point_day > 0),
    {
      message: 'Preço por ponto-dia é obrigatório',
      path: ['default_unit_price_point_day'],
    },
  );

type ProductFormData = z.infer<typeof productSchema>;

const TAX_TOOLTIP =
  'Imposto incidente sobre o item (IPI/ISS/etc). Usado no cálculo de margem líquida.';

export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories } = useProductCategories();
  const { units } = useMeasurementUnits();
  const { organization } = useCurrentOrganization();

  const defaultUnit = units.find((u) => u.is_default)?.abbreviation || 'un';
  const [imagePreview, setImagePreview] = useState<string>('');
  const [bomItems, setBomItems] = useState<ProductBomItemInput[]>([]);

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id!),
    enabled: isEdit,
  });

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

  // Hydrate when product loads
  useEffect(() => {
    if (!isEdit) return;
    if (!product) return;
    form.reset({
      name: product.name || '',
      type: (product.type as any) || 'produto',
      code: product.code || '',
      reference: product.reference || '',
      category_id: product.category_id || '',
      description: product.description || '',
      unit: product.unit || defaultUnit,
      cost: product.cost ?? undefined,
      price: product.price ?? undefined,
      ipi_percent: product.ipi_percent ?? 0,
      image_url: product.image_url || '',
      active: product.active ?? true,
      billing_type: (product.billing_type as BillingType) || 'one_time',
      billing_cycle: (product.billing_cycle as any) || 'monthly',
      monthly_price: product.monthly_price ?? undefined,
      minimum_contract_months: product.minimum_contract_months ?? 12,
      default_unit_price_point_day: product.default_unit_price_point_day ?? undefined,
      default_billing_days: product.default_billing_days ?? 1,
      default_quantity_points: product.default_quantity_points ?? 1,
      counts_for_commission: product.counts_for_commission ?? true,
    });
    setImagePreview(product.image_url || '');
  }, [product, isEdit, defaultUnit, form]);

  const billingType = form.watch('billing_type') as BillingType;
  const cost = form.watch('cost');
  const price = form.watch('price');
  const monthlyPrice = form.watch('monthly_price');
  const minimumContractMonths = form.watch('minimum_contract_months') || 12;
  const taxPercent = form.watch('ipi_percent');
  const ppdPrice = form.watch('default_unit_price_point_day');
  const ppdPoints = form.watch('default_quantity_points') || 1;
  const ppdDays = form.watch('default_billing_days') || 1;

  const margin = useMemo(
    () =>
      computeMargin({
        billing_type: billingType,
        price: price ?? null,
        monthly_price: monthlyPrice ?? null,
        point_day_price: ppdPrice ?? null,
        points: ppdPoints,
        days: ppdDays,
        cost: cost ?? null,
        tax_percent: taxPercent ?? null,
      }),
    [billingType, price, monthlyPrice, ppdPrice, ppdPoints, ppdDays, cost, taxPercent],
  );

  const contractTotal = (monthlyPrice || 0) * minimumContractMonths;

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        ...data,
        category_id: data.category_id || null,
        image_url: data.image_url || null,
        price:
          data.billing_type === 'recurring'
            ? data.monthly_price
            : data.billing_type === 'point_day'
              ? data.default_unit_price_point_day
              : data.price,
      };

      let saved: Product;
      if (isEdit && product) {
        saved = await updateProduct(product.id, payload);
      } else {
        saved = await createProduct(payload);
      }

      // Persist BOM only for point_day products
      if (data.billing_type === 'point_day' && organization?.id && saved?.id) {
        try {
          await replaceProductBomItems(organization.id, saved.id, bomItems);
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Produto salvo, mas BOM falhou',
            description: (err as Error).message,
          });
        }
      }
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', saved.id] });
      queryClient.invalidateQueries({ queryKey: ['product-bom', saved.id] });
      toast({
        title: isEdit ? 'Produto atualizado' : 'Produto criado',
        description: 'Operação realizada com sucesso.',
      });
      if (!isEdit && saved?.id) {
        navigate(`/app/products/${saved.id}/edit`, { replace: true });
      }
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    },
  });

  const onSubmit = (data: ProductFormData) => mutation.mutate(data);

  const handleImageUrlChange = (url: string) => {
    form.setValue('image_url', url);
    setImagePreview(url);
  };

  const billingBadge = (() => {
    if (billingType === 'recurring')
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600">
          <Repeat className="h-3 w-3 mr-1" /> MRR
        </Badge>
      );
    if (billingType === 'point_day')
      return (
        <Badge className="bg-sky-500 hover:bg-sky-600">
          <Zap className="h-3 w-3 mr-1" /> Ponto-dia
        </Badge>
      );
    return (
      <Badge variant="secondary">
        <Zap className="h-3 w-3 mr-1" /> Avulso
      </Badge>
    );
  })();

  if (isEdit && loadingProduct) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <TooltipProvider>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="w-full px-4 md:px-8 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Button asChild variant="ghost" size="icon">
                  <Link to="/app/products" aria-label="Voltar">
                    <ChevronLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold truncate">
                    {isEdit ? product?.name || 'Editar produto' : 'Novo produto / serviço'}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Modo de cobrança:</span>
                    {billingBadge}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/app/products')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> {isEdit ? 'Atualizar' : 'Criar'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="w-full px-4 md:px-8 py-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
            {/* Coluna esquerda: conteúdo principal */}
            <div className="space-y-6 min-w-0">
              {/* Identidade */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identidade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo *</Label>
                      <Select
                        value={form.watch('type')}
                        onValueChange={(v) => form.setValue('type', v as 'produto' | 'servico')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="produto">Produto</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={form.watch('category_id') || undefined}
                        onValueChange={(v) => form.setValue('category_id', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: cat.color }}
                                />
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
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="code">Código</Label>
                      <Input id="code" {...form.register('code')} placeholder="Ex: PROD-001" />
                    </div>
                    <div>
                      <Label htmlFor="reference">Referência / SKU</Label>
                      <Input id="reference" {...form.register('reference')} placeholder="Ex: REF-ABC" />
                    </div>
                  </div>

                  <div>
                    <Label>Descrição</Label>
                    <RichTextEditor
                      value={form.watch('description') || ''}
                      onChange={(value) => form.setValue('description', value)}
                      placeholder="Descreva o produto ou serviço..."
                      minHeight="160px"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Imagem */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Imagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageUpload
                    value={imagePreview}
                    onChange={handleImageUrlChange}
                    organizationId={organization?.id || ''}
                  />
                </CardContent>
              </Card>

              {/* Configuração de Preço */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    💰 Configuração de Preço {billingBadge}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Modo de cobrança */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 bg-muted/30 rounded-lg border">
                    {(
                      [
                        { v: 'one_time', label: 'Avulso', sub: 'Cobrança única', icon: Zap, color: 'amber' },
                        { v: 'recurring', label: 'Recorrente (MRR)', sub: 'Mensalidade', icon: Repeat, color: 'emerald' },
                        { v: 'point_day', label: 'Ponto-dia', sub: 'Pontos × diárias', icon: Zap, color: 'sky' },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const active = billingType === opt.v;
                      return (
                        <label
                          key={opt.v}
                          className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                            active ? 'bg-background border-primary shadow-sm' : 'hover:bg-background/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="billing_type"
                            value={opt.v}
                            checked={active}
                            onChange={() => form.setValue('billing_type', opt.v)}
                            className="h-4 w-4 accent-primary"
                          />
                          <Icon className={`h-4 w-4 text-${opt.color}-500`} />
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.sub}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Campos comuns: Unidade, Custo, Imposto */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Unidade *</Label>
                      <Select
                        value={form.watch('unit')}
                        onValueChange={(v) => form.setValue('unit', v)}
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="ipi_percent" className="flex items-center gap-1">
                        Imposto (%)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground cursor-help text-xs">ⓘ</span>
                          </TooltipTrigger>
                          <TooltipContent>{TAX_TOOLTIP}</TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="ipi_percent"
                        type="number"
                        step="0.01"
                        {...form.register('ipi_percent')}
                        placeholder="0"
                      />
                    </div>
                    {billingType === 'one_time' && (
                      <div>
                        <Label htmlFor="price">Preço de venda (R$)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          {...form.register('price')}
                          placeholder="0,00"
                        />
                      </div>
                    )}
                    {billingType === 'recurring' && (
                      <div>
                        <Label htmlFor="monthly_price">Preço mensal (R$) *</Label>
                        <Input
                          id="monthly_price"
                          type="number"
                          step="0.01"
                          {...form.register('monthly_price')}
                          placeholder="0,00"
                          className={
                            form.formState.errors.monthly_price ? 'border-destructive' : ''
                          }
                        />
                      </div>
                    )}
                    {billingType === 'point_day' && (
                      <div>
                        <Label htmlFor="default_unit_price_point_day">
                          Preço por ponto-dia (R$) *
                        </Label>
                        <Input
                          id="default_unit_price_point_day"
                          type="number"
                          step="0.01"
                          {...form.register('default_unit_price_point_day')}
                          placeholder="0,00"
                          className={
                            form.formState.errors.default_unit_price_point_day
                              ? 'border-destructive'
                              : ''
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Campos específicos */}
                  {billingType === 'recurring' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Ciclo</Label>
                        <Select
                          value={form.watch('billing_cycle') || 'monthly'}
                          onValueChange={(v) => form.setValue('billing_cycle', v as any)}
                        >
                          <SelectTrigger>
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
                      <div>
                        <Label>Contrato mínimo</Label>
                        <Select
                          value={String(form.watch('minimum_contract_months') || 12)}
                          onValueChange={(v) =>
                            form.setValue('minimum_contract_months', parseInt(v))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 3, 6, 12, 24, 36].map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {m} {m === 1 ? 'mês' : 'meses'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {billingType === 'point_day' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
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
                      </div>
                      <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 text-sm">
                        <strong>Cálculo:</strong> pontos × diárias × preço por ponto-dia.
                        Estoque reservado considera apenas a quantidade de pontos durante o período do evento.
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* BOM (apenas ponto-dia) */}
              {billingType === 'point_day' && organization?.id && (
                <Card>
                  <CardContent className="pt-6">
                    <ProductBOMEditor
                      organizationId={organization.id}
                      productId={product?.id ?? null}
                      value={bomItems}
                      onChange={setBomItems}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Coluna direita: resumo + flags */}
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Resumo financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Row label="Receita bruta" value={formatCurrencyBR(margin.revenue)} />
                  <Row
                    label={`Imposto (${(taxPercent || 0).toFixed(2)}%)`}
                    value={`− ${formatCurrencyBR(margin.tax_amount)}`}
                    muted
                  />
                  <Row
                    label="Receita líquida"
                    value={formatCurrencyBR(margin.net_revenue)}
                    strong
                  />
                  <Row label="Custo" value={`− ${formatCurrencyBR(margin.cost)}`} muted />
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Margem</span>
                    <div className="text-right">
                      <div
                        className={`font-bold text-lg ${
                          margin.margin_percent > 0
                            ? 'text-emerald-600'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {margin.margin_percent.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrencyBR(margin.margin_amount)}
                      </div>
                    </div>
                  </div>

                  {billingType === 'recurring' && (monthlyPrice || 0) > 0 && (
                    <div className="mt-3 pt-3 border-t text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">MRR</span>
                        <span className="font-semibold text-emerald-600">
                          {formatCurrencyBR(monthlyPrice || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Contrato ({minimumContractMonths}m)
                        </span>
                        <span className="font-semibold">{formatCurrencyBR(contractTotal)}</span>
                      </div>
                    </div>
                  )}

                  {billingType === 'point_day' && (
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      Base: {ppdPoints} pts × {ppdDays} dia(s) × {formatCurrencyBR(ppdPrice || 0)}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Status</Label>
                      <p className="text-xs text-muted-foreground">Produto ativo no catálogo</p>
                    </div>
                    <Switch
                      checked={form.watch('active')}
                      onCheckedChange={(c) => form.setValue('active', c)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <Label className="text-sm">Contabiliza na meta</Label>
                      <p className="text-xs text-muted-foreground">
                        Conta para metas e comissões dos vendedores
                      </p>
                    </div>
                    <Switch
                      checked={form.watch('counts_for_commission')}
                      onCheckedChange={(c) => form.setValue('counts_for_commission', c)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => navigate('/app/products')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
              </Button>
            </div>
          </div>
        </form>
      </TooltipProvider>
    </Layout>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={strong ? 'font-semibold' : muted ? 'text-muted-foreground' : ''}>
        {value}
      </span>
    </div>
  );
}
