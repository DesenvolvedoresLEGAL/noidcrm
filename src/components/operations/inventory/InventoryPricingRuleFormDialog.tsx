import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  inventoryPricingRuleSchema,
  RISK_LABEL,
  RISK_LEVELS,
  type InventoryPricingRuleInput,
} from '@/lib/operations/inventoryPricing';
import {
  useCreateInventoryPricingRule,
  useUpdateInventoryPricingRule,
} from '@/hooks/operations/useInventoryPricing';
import { useInventoryCategories } from '@/hooks/operations/useInventoryCategories';
import { useInventoryFamilies } from '@/hooks/operations/useInventoryFamilies';
import type { InventoryPricingRule } from '@/services/operations/inventoryPricing';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule?: InventoryPricingRule | null;
}

export function InventoryPricingRuleFormDialog({ open, onOpenChange, rule }: Props) {
  const create = useCreateInventoryPricingRule();
  const update = useUpdateInventoryPricingRule();
  const { data: categories } = useInventoryCategories();
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null);
  const { data: families } = useInventoryFamilies(categoryId ?? undefined);

  const form = useForm<InventoryPricingRuleInput>({
    resolver: zodResolver(inventoryPricingRuleSchema) as any,
    defaultValues: {
      name: rule?.name ?? '',
      description: rule?.description ?? '',
      category_id: rule?.category_id ?? null,
      family_id: rule?.family_id ?? null,
      min_occupancy_rate: rule?.min_occupancy_rate ?? 0,
      max_occupancy_rate: rule?.max_occupancy_rate ?? null,
      price_adjustment_type: (rule?.price_adjustment_type as any) ?? 'percent',
      price_adjustment_value: rule?.price_adjustment_value ?? 0,
      max_discount_percent: rule?.max_discount_percent ?? null,
      requires_approval: rule?.requires_approval ?? false,
      risk_level: (rule?.risk_level as any) ?? 'low',
      status: (rule?.status as any) ?? 'active',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: InventoryPricingRuleInput = {
      ...values,
      category_id: values.category_id || null,
      family_id: values.family_id || null,
      max_occupancy_rate: values.max_occupancy_rate ?? null,
      max_discount_percent: values.max_discount_percent ?? null,
    };
    if (rule) {
      await update.mutateAsync({ id: rule.id, patch: payload as any });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  });

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regra' : 'Nova regra'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input {...form.register('name')} />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea rows={2} {...form.register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria (opcional)</Label>
              <Select
                value={form.watch('category_id') ?? 'all'}
                onValueChange={(v) => {
                  const value = v === 'all' ? null : v;
                  form.setValue('category_id', value as any);
                  setCategoryId(value);
                  form.setValue('family_id', null as any);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(categories ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Família (opcional)</Label>
              <Select
                value={form.watch('family_id') ?? 'all'}
                onValueChange={(v) =>
                  form.setValue('family_id', (v === 'all' ? null : v) as any)
                }
                disabled={!categoryId}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(families ?? []).map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Faixa mínima (%)</Label>
              <Input type="number" step="0.01" {...form.register('min_occupancy_rate')} />
            </div>
            <div className="grid gap-2">
              <Label>Faixa máxima (%)</Label>
              <Input type="number" step="0.01" {...form.register('max_occupancy_rate')} placeholder="vazio = sem teto" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Tipo de ajuste</Label>
              <Select
                value={form.watch('price_adjustment_type')}
                onValueChange={(v) => form.setValue('price_adjustment_type', v as any)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valor do ajuste</Label>
              <Input type="number" step="0.01" {...form.register('price_adjustment_value')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Desconto máximo (%) — opcional</Label>
              <Input type="number" step="0.01" {...form.register('max_discount_percent')} />
            </div>
            <div className="grid gap-2">
              <Label>Risco</Label>
              <Select
                value={form.watch('risk_level')}
                onValueChange={(v) => form.setValue('risk_level', v as any)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>{RISK_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Exige aprovação para descontos</Label>
              <p className="text-xs text-muted-foreground">
                Sinaliza quando o vendedor tentar descontar acima do permitido.
              </p>
            </div>
            <Switch
              checked={form.watch('requires_approval')}
              onCheckedChange={(v) => form.setValue('requires_approval', v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rule ? 'Salvar' : 'Criar regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
