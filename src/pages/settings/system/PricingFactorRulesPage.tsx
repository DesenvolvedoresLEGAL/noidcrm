import { useState } from 'react';
import { Plus, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  usePricingFactorRules,
  useUpsertPricingFactorRule,
  useSetPricingFactorRuleStatus,
} from '@/hooks/proposals/usePricingFactorRules';
import type { PricingFactorRule } from '@/services/proposals/proposalDynamicPricing';

export default function PricingFactorRulesPage() {
  const { data: rules = [], isLoading } = usePricingFactorRules();
  const upsert = useUpsertPricingFactorRule();
  const setStatus = useSetPricingFactorRuleStatus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PricingFactorRule> | null>(null);

  const openNew = () => {
    setEditing({
      name: '',
      label: '',
      min_days_before_event: 0,
      max_days_before_event: null,
      adjustment_type: 'percent',
      adjustment_value: 0,
      sort_order: rules.length + 1,
      status: 'active',
    });
    setOpen(true);
  };

  const openEdit = (r: PricingFactorRule) => {
    setEditing(r);
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    await upsert.mutateAsync(editing);
    setOpen(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faixas de Antecedência do Evento</h1>
          <p className="text-sm text-muted-foreground">
            Configura os ajustes aplicados automaticamente à tabela dinâmica de proposta com base nos dias até o evento.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova faixa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faixas configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma faixa configurada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left p-2">Ordem</th>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Dias min</th>
                  <th className="text-left p-2">Dias max</th>
                  <th className="text-left p-2">Ajuste</th>
                  <th className="text-left p-2">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.sort_order}</td>
                    <td className="p-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.label}</div>
                    </td>
                    <td className="p-2">{r.min_days_before_event ?? '—'}</td>
                    <td className="p-2">
                      {r.max_days_before_event === -1
                        ? 'pós evento'
                        : r.max_days_before_event ?? '—'}
                    </td>
                    <td className="p-2">
                      {r.adjustment_type === 'percent'
                        ? `${r.adjustment_value > 0 ? '+' : ''}${r.adjustment_value}%`
                        : `${r.adjustment_value > 0 ? '+' : ''}${r.adjustment_value}`}
                    </td>
                    <td className="p-2">
                      <Badge variant={r.status === 'active' ? 'default' : 'outline'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setStatus.mutate({
                            id: r.id,
                            status: r.status === 'active' ? 'inactive' : 'active',
                          })
                        }
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar faixa' : 'Nova faixa'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Nome">
                <Input
                  value={editing.name ?? ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Descrição (label)">
                <Input
                  value={editing.label ?? ''}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dias mínimos antes do evento (vazio = sem mínimo)">
                  <Input
                    type="number"
                    value={editing.min_days_before_event ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        min_days_before_event:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Dias máximos antes do evento (-1 = pós evento)">
                  <Input
                    type="number"
                    value={editing.max_days_before_event ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        max_days_before_event:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de ajuste">
                  <Select
                    value={editing.adjustment_type ?? 'percent'}
                    onValueChange={(v) =>
                      setEditing({ ...editing, adjustment_type: v as 'percent' | 'fixed' })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor de ajuste">
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.adjustment_value ?? 0}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        adjustment_value: Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ordem">
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={editing.status ?? 'active'}
                    onValueChange={(v) =>
                      setEditing({ ...editing, status: v as 'active' | 'inactive' })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
