import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  REVENUE_TYPES,
  REVENUE_TYPE_LABEL,
  DYNAMIC_PRICING_APPLICABILITIES,
  DYNAMIC_PRICING_APPLICABILITY_LABEL,
  DYNAMIC_PRICING_MODES,
  DYNAMIC_PRICING_MODE_LABEL,
  VALIDITY_STRATEGIES,
  VALIDITY_STRATEGY_LABEL,
  PAYMENT_MODES,
  PAYMENT_MODE_LABEL,
} from '@/lib/proposals/proposalTemplateRules';
import type { ProposalTemplate } from '@/services/crm/proposal-templates';

interface Props {
  data: Partial<ProposalTemplate>;
  onChange: (field: keyof ProposalTemplate, value: any) => void;
}

const NULL_REVENUE = '__none__';

export function TemplateCommercialRulesTab({ data, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras Comerciais do Template</CardTitle>
        <CardDescription>
          Define como propostas criadas a partir deste template se comportam
          comercialmente (receita, tabela dinâmica, validade e pagamento).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de receita</Label>
          <Select
            value={(data.revenue_type as string) || NULL_REVENUE}
            onValueChange={(v) => onChange('revenue_type', v === NULL_REVENUE ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NULL_REVENUE}>—</SelectItem>
              {REVENUE_TYPES.map((r) => (
                <SelectItem key={r} value={r}>{REVENUE_TYPE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Aplicar tabela dinâmica</Label>
          <Select
            value={data.dynamic_pricing_applicability || 'none'}
            onValueChange={(v) => onChange('dynamic_pricing_applicability', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DYNAMIC_PRICING_APPLICABILITIES.map((r) => (
                <SelectItem key={r} value={r}>{DYNAMIC_PRICING_APPLICABILITY_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Modo da tabela dinâmica</Label>
          <Select
            value={data.dynamic_pricing_mode || 'none'}
            onValueChange={(v) => onChange('dynamic_pricing_mode', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DYNAMIC_PRICING_MODES.map((r) => (
                <SelectItem key={r} value={r}>{DYNAMIC_PRICING_MODE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Regra de validade</Label>
          <Select
            value={data.validity_strategy || 'fixed_days_from_creation'}
            onValueChange={(v) => onChange('validity_strategy', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VALIDITY_STRATEGIES.map((r) => (
                <SelectItem key={r} value={r}>{VALIDITY_STRATEGY_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Validade padrão (dias)</Label>
          <Input
            type="number"
            min={0}
            value={data.default_validity_days ?? ''}
            onChange={(e) =>
              onChange(
                'default_validity_days',
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
            placeholder="Ex: 15"
          />
        </div>

        <div className="space-y-2">
          <Label>Modo de pagamento padrão</Label>
          <Select
            value={data.default_payment_mode || 'one_time'}
            onValueChange={(v) => onChange('default_payment_mode', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_MODES.map((r) => (
                <SelectItem key={r} value={r}>{PAYMENT_MODE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ToggleRow
          label="Exigir validade da proposta"
          checked={!!data.requires_valid_until}
          onChange={(v) => onChange('requires_valid_until', v)}
        />
        <ToggleRow
          label="Permitir recorrência"
          checked={!!data.allow_recurring}
          onChange={(v) => onChange('allow_recurring', v)}
        />
        <ToggleRow
          label="Exibir tabela dinâmica no link público"
          checked={!!data.show_dynamic_pricing_on_public_link}
          onChange={(v) => onChange('show_dynamic_pricing_on_public_link', v)}
        />
        <ToggleRow
          label="Exibir tabela dinâmica no PDF"
          checked={!!data.show_dynamic_pricing_on_pdf}
          onChange={(v) => onChange('show_dynamic_pricing_on_pdf', v)}
        />
        <ToggleRow
          label="Permitir Pix"
          checked={data.allow_pix_payment !== false}
          onChange={(v) => onChange('allow_pix_payment', v)}
        />
        <ToggleRow
          label="Permitir cobrança complementar"
          checked={data.allow_complementary_charge !== false}
          onChange={(v) => onChange('allow_complementary_charge', v)}
        />
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
