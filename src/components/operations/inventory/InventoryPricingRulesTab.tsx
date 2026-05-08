import { useState } from 'react';
import { Plus, Pencil, Power, PowerOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useActivateInventoryPricingRule,
  useDeactivateInventoryPricingRule,
  useInventoryPricingRules,
} from '@/hooks/operations/useInventoryPricing';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import {
  RISK_LABEL,
  riskBadgeVariant,
  type PricingRisk,
} from '@/lib/operations/inventoryPricing';
import { InventoryPricingRuleFormDialog } from './InventoryPricingRuleFormDialog';
import type { InventoryPricingRule } from '@/services/operations/inventoryPricing';

function formatRange(min: number, max: number | null) {
  if (max == null) return `≥ ${min}%`;
  return `${min}% — ${max}%`;
}

export function InventoryPricingRulesTab() {
  const { isAdmin } = useCurrentOrganization();
  const { data, isLoading } = useInventoryPricingRules();
  const deactivate = useDeactivateInventoryPricingRule();
  const activate = useActivateInventoryPricingRule();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryPricingRule | null>(null);

  const rules = data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Regras de Preço por Ocupação</CardTitle>
          <CardDescription>
            Define o fator comercial aplicado quando o estoque está pressionado no período operacional.
          </CardDescription>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova regra
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma regra cadastrada.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead>Desconto máx.</TableHead>
                <TableHead>Aprovação</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{formatRange(r.min_occupancy_rate, r.max_occupancy_rate)}</TableCell>
                  <TableCell>
                    {r.price_adjustment_type === 'percent'
                      ? `+${r.price_adjustment_value}%`
                      : `+R$ ${r.price_adjustment_value.toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    {r.max_discount_percent == null ? 'Livre' : `${r.max_discount_percent}%`}
                  </TableCell>
                  <TableCell>{r.requires_approval ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <Badge variant={riskBadgeVariant(r.risk_level)}>
                      {RISK_LABEL[r.risk_level as PricingRisk]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'active' ? 'default' : 'outline'}>
                      {r.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditing(r); setOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {r.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deactivate.mutate(r.id)}
                            title="Desativar"
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => activate.mutate(r.id)}
                            title="Ativar"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-3">
            Somente administradores e owners podem editar essas regras.
          </p>
        )}
      </CardContent>
      {open && (
        <InventoryPricingRuleFormDialog open={open} onOpenChange={setOpen} rule={editing} />
      )}
    </Card>
  );
}
