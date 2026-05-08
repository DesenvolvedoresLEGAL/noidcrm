import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPE_LABEL,
  computeFinalAmount,
  formatBRL,
  tiersOverlap,
  type AdjustmentType,
  type DynamicPricingTierInput,
} from '@/lib/proposals/dynamicPricing';

interface Props {
  baseAmount: number;
  tiers: DynamicPricingTierInput[];
  onChange: (tiers: DynamicPricingTierInput[]) => void;
  disabled?: boolean;
}

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function DynamicPricingTierEditor({
  baseAmount,
  tiers,
  onChange,
  disabled,
}: Props) {
  const overlap = useMemo(() => tiersOverlap(tiers), [tiers]);

  const updateTier = (idx: number, patch: Partial<DynamicPricingTierInput>) => {
    const next = tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    onChange(next);
  };

  const removeTier = (idx: number) => {
    onChange(tiers.filter((_, i) => i !== idx));
  };

  const addTier = () => {
    onChange([
      ...tiers,
      {
        label: '',
        starts_at: null,
        ends_at: null,
        adjustment_type: 'base_amount',
        adjustment_value: 0,
        tier_order: tiers.length,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {overlap && (
        <Alert variant="destructive">
          <AlertDescription>
            Há sobreposição de períodos entre as condições. Ajuste antes de salvar.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Condição</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-32">Ajuste</TableHead>
              <TableHead className="text-right">Valor final</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Nenhuma condição. Clique em "Adicionar condição".
                </TableCell>
              </TableRow>
            ) : (
              tiers.map((t, idx) => {
                const final = computeFinalAmount(
                  baseAmount,
                  t.adjustment_type,
                  Number(t.adjustment_value || 0),
                );
                return (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={t.label}
                        disabled={disabled}
                        placeholder="Ex.: Antecipado"
                        onChange={(e) => updateTier(idx, { label: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="datetime-local"
                        disabled={disabled}
                        value={toLocalInput(t.starts_at)}
                        onChange={(e) =>
                          updateTier(idx, { starts_at: fromLocalInput(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="datetime-local"
                        disabled={disabled}
                        value={toLocalInput(t.ends_at)}
                        onChange={(e) =>
                          updateTier(idx, { ends_at: fromLocalInput(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={t.adjustment_type}
                        disabled={disabled}
                        onValueChange={(v) =>
                          updateTier(idx, { adjustment_type: v as AdjustmentType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADJUSTMENT_TYPES.map((a) => (
                            <SelectItem key={a} value={a}>
                              {ADJUSTMENT_TYPE_LABEL[a]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        disabled={disabled || t.adjustment_type === 'base_amount'}
                        value={t.adjustment_value ?? 0}
                        onChange={(e) =>
                          updateTier(idx, {
                            adjustment_value: Number(e.target.value),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatBRL(final)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => removeTier(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addTier}
        disabled={disabled}
        type="button"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar condição
      </Button>
    </div>
  );
}
