import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ClipboardCheck, ShieldCheck, ArrowRightCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/lib/dateUtils';
import type { HandoffFormBundle } from '@/hooks/useHandoffFormValues';

const SEMANTIC_KEYS = [
  'nome_evento',
  'data_evento',
  'local_evento',
  'conexoes_simultaneas',
  'equipamentos',
  'finalidade_uso',
  'urgencia_real',
  'poder_decisao',
  'proximo_passo',
  'proximo_passo_observacao',
  'permissao_proposta',
] as const;

const LABELS: Record<string, string> = {
  nome_evento: 'Evento',
  data_evento: 'Data do evento',
  local_evento: 'Local',
  conexoes_simultaneas: 'Conexões simultâneas',
  equipamentos: 'Equipamentos',
  finalidade_uso: 'Finalidade de uso',
  urgencia_real: 'Urgência real',
  poder_decisao: 'Poder / influência',
  proximo_passo: 'Próximo passo',
  proximo_passo_observacao: 'Observação do próximo passo',
  permissao_proposta: 'Permissão para proposta',
};

interface QualificationSummaryCardProps {
  opportunity: {
    handoff_status?: string | null;
    qualified_at?: string | null;
    qualified_by?: { full_name: string | null } | null;
    source_opportunity?: { id: string; title: string; pipeline: { name: string } | null } | null;
    account?: { razao_social?: string | null; nome_fantasia?: string | null } | null;
    contact?: { nome?: string | null } | null;
  };
  handoffBundles: HandoffFormBundle[];
  qualScore?: {
    score?: number | null;
    tier?: string | null;
    hasForm?: boolean;
  };
}

function formatValue(key: string, raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (Array.isArray(raw)) return raw.length ? raw.join(', ') : '—';
  if (typeof raw === 'boolean') return raw ? 'Sim' : 'Não';
  if (key === 'data_evento' && typeof raw === 'string') {
    try { return formatDateBR(raw); } catch { return String(raw); }
  }
  return String(raw);
}

export function QualificationSummaryCard({
  opportunity,
  handoffBundles,
  qualScore,
}: QualificationSummaryCardProps) {
  // Gather all custom_field UUIDs referenced as "custom" fields across the bundles.
  const customFieldIds = useMemo(() => {
    const ids = new Set<string>();
    handoffBundles.forEach((b) =>
      b.form.fields.forEach((f) => {
        if (f.source === 'custom' && f.field_key) ids.add(f.field_key);
      }),
    );
    return Array.from(ids);
  }, [handoffBundles]);

  const { data: customFieldMeta = {} } = useQuery({
    queryKey: ['qual-summary-custom-fields', customFieldIds.sort().join(',')],
    enabled: customFieldIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('id, field_key')
        .in('id', customFieldIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      (data || []).forEach((row: any) => { m[row.id] = row.field_key; });
      return m;
    },
  });

  // Build semantic_key -> value across all bundles.
  const semanticValues = useMemo(() => {
    const out: Record<string, any> = {};
    handoffBundles.forEach((bundle) => {
      bundle.form.fields.forEach((f) => {
        const semanticKey =
          f.source === 'custom'
            ? customFieldMeta[f.field_key]
            : f.field_key;
        if (!semanticKey || !SEMANTIC_KEYS.includes(semanticKey as any)) return;
        const v = bundle.valuesRow.values?.[f.id];
        if (v !== undefined && v !== null && v !== '' && out[semanticKey] === undefined) {
          out[semanticKey] = v;
        }
      });
    });
    return out;
  }, [handoffBundles, customFieldMeta]);

  const accountName =
    opportunity.account?.nome_fantasia ||
    opportunity.account?.razao_social ||
    '—';
  const contactName = opportunity.contact?.nome || '—';

  const handoffStatus = opportunity.handoff_status || (handoffBundles.length > 0 ? 'approved' : null);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Resumo da Qualificação
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            {qualScore?.hasForm && typeof qualScore.score === 'number' && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Score {qualScore.score}
                {qualScore.tier ? ` • ${qualScore.tier}` : ''}
              </Badge>
            )}
            {handoffStatus && (
              <Badge variant={handoffStatus === 'approved' ? 'default' : 'destructive'}>
                {handoffStatus === 'approved' ? 'Passagem aprovada' : handoffStatus}
              </Badge>
            )}
          </div>
        </div>
        {(opportunity.qualified_by?.full_name || opportunity.qualified_at || opportunity.source_opportunity) && (
          <p className="text-xs text-muted-foreground mt-1">
            {opportunity.qualified_by?.full_name && `Qualificado por ${opportunity.qualified_by.full_name}`}
            {opportunity.qualified_at && ` • ${formatDateBR(opportunity.qualified_at)}`}
            {opportunity.source_opportunity && (
              <>
                {' • '}
                <Link
                  to={`/app/opportunities/${opportunity.source_opportunity.id}`}
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Ver oportunidade original <ArrowRightCircle className="h-3 w-3" />
                </Link>
              </>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <SummaryRow label="Empresa" value={accountName} />
          <SummaryRow label="Contato" value={contactName} />
          {SEMANTIC_KEYS.map((k) => (
            <SummaryRow key={k} label={LABELS[k]} value={formatValue(k, semanticValues[k])} />
          ))}
        </div>
        {handoffBundles.length === 0 && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Nenhum checklist de Pré-vendas recebido para esta oportunidade.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value || '—'}</span>
    </div>
  );
}
