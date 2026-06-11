import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import type { QualifiedQueueFilters } from '@/services/intelligence/qualifiedQueue';

interface Props {
  value: QualifiedQueueFilters;
  onChange: (v: QualifiedQueueFilters) => void;
}

export function QualifiedQueueFiltersBar({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar empresa…"
        value={value.search ?? ''}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        className="w-56"
      />
      <Select
        value={(value.status as string) ?? 'all'}
        onValueChange={(v) => onChange({ ...value, status: v as any })}
      >
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="captured">Capturado</SelectItem>
          <SelectItem value="enriched">Enriquecido</SelectItem>
          <SelectItem value="decision_maker_found">Decisor encontrado</SelectItem>
          <SelectItem value="contact_revealed">Contato revelado</SelectItem>
          <SelectItem value="approach_ready">Brief pronto</SelectItem>
          <SelectItem value="ready_for_sdr">Pronto para SDR</SelectItem>
          <SelectItem value="human_review">Em revisão</SelectItem>
          <SelectItem value="imported">Importado</SelectItem>
          <SelectItem value="discarded">Descartado</SelectItem>
          <SelectItem value="duplicate">Duplicado</SelectItem>
          <SelectItem value="existing_customer">Cliente existente</SelectItem>
          <SelectItem value="existing_account">Conta existente</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={(value.relationship as string) ?? 'all'}
        onValueChange={(v) => onChange({ ...value, relationship: v })}
      >
        <SelectTrigger className="w-44"><SelectValue placeholder="Relacionamento" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos relacionamentos</SelectItem>
          <SelectItem value="new_prospect">⚪ Novo</SelectItem>
          <SelectItem value="account_existing">🟡 Conta existente</SelectItem>
          <SelectItem value="opportunity_existing">🟠 Oportunidade aberta</SelectItem>
          <SelectItem value="customer">🟢 Cliente</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={String(value.scoreMin ?? 0)}
        onValueChange={(v) => onChange({ ...value, scoreMin: Number(v) })}
      >
        <SelectTrigger className="w-36"><SelectValue placeholder="Score mín." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Score ≥ 0</SelectItem>
          <SelectItem value="40">Score ≥ 40</SelectItem>
          <SelectItem value="60">Score ≥ 60</SelectItem>
          <SelectItem value="80">Score ≥ 80</SelectItem>
        </SelectContent>
      </Select>
      <Toggle
        pressed={value.withDecisionMaker === true}
        onPressedChange={(p) => onChange({ ...value, withDecisionMaker: p ? true : null })}
      >
        Com decisor
      </Toggle>
      <Toggle
        pressed={!!value.sdrReadyOnly}
        onPressedChange={(p) => onChange({ ...value, sdrReadyOnly: p })}
      >
        SDR Ready
      </Toggle>
      <Toggle
        pressed={!!value.humanReviewOnly}
        onPressedChange={(p) => onChange({ ...value, humanReviewOnly: p })}
      >
        Em revisão
      </Toggle>
      <Toggle
        pressed={!!value.icpOnly}
        onPressedChange={(p) => onChange({ ...value, icpOnly: p })}
      >
        ICP
      </Toggle>
    </div>
  );
}
