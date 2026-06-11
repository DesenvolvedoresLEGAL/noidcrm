/**
 * Sprint REVOPS V3.3 — Hook agregador da aba "Pipeline Health".
 *
 * Lê apenas dados existentes (opportunities + profiles + stages) e calcula
 * indicadores de confiabilidade do CRM. Escopo restrito ao Pipeline de Vendas
 * oficial (mesma resolução usada pelo Forecast / V3.1A).
 *
 * Nenhuma view, edge function ou regra financeira é alterada.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastSalesPipeline } from '@/hooks/forecast/useForecastSalesPipeline';

const STALE_DAYS = 14;

export type PipelineIssueId =
  | 'no_owner'
  | 'no_value'
  | 'no_next_activity'
  | 'stale'
  | 'overdue'
  | 'duplicate'
  | 'no_account'
  | 'no_contact';

const ISSUE_WEIGHT: Record<PipelineIssueId, number> = {
  no_owner: 2,
  no_value: 2,
  no_next_activity: 1,
  stale: 2,
  overdue: 3,
  duplicate: 5,
  no_account: 2,
  no_contact: 2,
};

const ISSUE_LABEL: Record<PipelineIssueId, string> = {
  no_owner: 'Sem Owner',
  no_value: 'Sem Valor',
  no_next_activity: 'Sem Próxima Atividade',
  stale: 'Paradas +14 dias',
  overdue: 'Vencidas',
  duplicate: 'Possíveis Duplicadas',
  no_account: 'Sem Empresa',
  no_contact: 'Sem Contato',
};

export interface CriticalIssue {
  id: PipelineIssueId;
  label: string;
  count: number;
  value: number;
  opportunityIds: string[];
}

export interface StageHealth {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
  avgAgeDays: number;
  health: 'green' | 'yellow' | 'red';
}

export interface HygieneRanking {
  ownerId: string;
  ownerName: string;
  avatarUrl: string | null;
  total: number;
  issues: number;
  score: number;
}

export interface RecommendedAction {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  impactValue: number;
  count: number;
  filterIssue: PipelineIssueId;
}

export interface PipelineHealthData {
  trustScore: number;
  trustLabel: 'Excelente' | 'Confiável' | 'Atenção' | 'Crítico';
  totalOpen: number;
  totalOpenValue: number;
  diagnosis: string;
  issues: CriticalIssue[];
  moneyAtRisk: {
    noActivityValue: number;
    overdueValue: number;
    staleValue: number;
  };
  stages: StageHealth[];
  ranking: HygieneRanking[];
  actions: RecommendedAction[];
  scope: {
    label: string;
    pipelineId: string | null;
    pipelineName: string | null;
    resolved: boolean;
  };
  meta: { generatedAt: string };
}

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function trustLabel(score: number): PipelineHealthData['trustLabel'] {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Confiável';
  if (score >= 70) return 'Atenção';
  return 'Crítico';
}

interface OpportunityRow {
  id: string;
  title: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  status: string | null;
  owner_user_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  valor_previsto: number | null;
  close_date_prevista: string | null;
  next_followup_date: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export function useRevenuePipelineHealth() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const { salesPipelineId, salesPipelineName, salesPipelineStatus } =
    useForecastSalesPipeline({ organizationId: orgId });
  const pipelineResolved =
    salesPipelineStatus === 'resolved' && !!salesPipelineId;

  const query = useQuery({
    queryKey: [
      'revenue-command:pipeline-health',
      orgId,
      salesPipelineId,
    ],
    enabled: !!orgId && pipelineResolved,
    staleTime: 60_000,
    queryFn: async () => {
      // 1) Open opportunities of the sales pipeline
      const oppQ = await supabase
        .from('opportunities')
        .select(
          'id,title,pipeline_id,stage_id,status,owner_user_id,account_id,contact_id,valor_previsto,close_date_prevista,next_followup_date,updated_at,created_at',
        )
        .eq('organization_id', orgId!)
        .eq('pipeline_id', salesPipelineId!)
        .is('deleted_at', null)
        .eq('status', 'open');
      if (oppQ.error) throw oppQ.error;
      const opps = (oppQ.data ?? []) as OpportunityRow[];

      // 2) Stages of the sales pipeline (names + order)
      const stagesQ = await supabase
        .from('stages')
        .select('id,name,order_index,pipeline_id')
        .eq('organization_id', orgId!)
        .eq('pipeline_id', salesPipelineId!);
      if (stagesQ.error) throw stagesQ.error;
      const stagesMap = new Map<string, { name: string; order: number }>();
      (stagesQ.data ?? []).forEach((s: any) =>
        stagesMap.set(String(s.id), {
          name: s.name ?? '—',
          order: s.order_index ?? 0,
        }),
      );

      // 3) Owners
      const ownerIds = Array.from(
        new Set(opps.map((o) => o.owner_user_id).filter(Boolean) as string[]),
      );
      const profilesMap = new Map<
        string,
        { name: string; avatar_url: string | null }
      >();
      if (ownerIds.length > 0) {
        const profQ = await supabase
          .from('profiles')
          .select('id,full_name,avatar_url,email')
          .in('id', ownerIds);
        if (!profQ.error) {
          (profQ.data ?? []).forEach((p: any) =>
            profilesMap.set(String(p.id), {
              name: p.full_name || p.email || 'Sem nome',
              avatar_url: p.avatar_url ?? null,
            }),
          );
        }
      }

      return { opps, stagesMap, profilesMap };
    },
  });

  return useMemo<{
    data: PipelineHealthData | null;
    isLoading: boolean;
    error: Error | null;
  }>(() => {
    const scope = {
      label: 'Pipeline de Vendas',
      pipelineId: salesPipelineId ?? null,
      pipelineName: salesPipelineName ?? null,
      resolved: pipelineResolved,
    };

    if (!orgId || !pipelineResolved || !query.data) {
      return {
        data: query.data
          ? null
          : pipelineResolved
            ? null
            : ({
                trustScore: 0,
                trustLabel: 'Crítico',
                totalOpen: 0,
                totalOpenValue: 0,
                diagnosis:
                  'Pipeline comercial não configurado. Defina o pipeline oficial de Vendas em Configurações > Forecast.',
                issues: [],
                moneyAtRisk: {
                  noActivityValue: 0,
                  overdueValue: 0,
                  staleValue: 0,
                },
                stages: [],
                ranking: [],
                actions: [],
                scope,
                meta: { generatedAt: new Date().toISOString() },
              } satisfies PipelineHealthData),
        isLoading: query.isLoading,
        error: (query.error as Error) ?? null,
      };
    }

    const { opps, stagesMap, profilesMap } = query.data;
    const now = Date.now();
    const STALE_MS = STALE_DAYS * 86_400_000;

    // ── Detecta duplicidades por (titulo normalizado + account_id)
    const dupKey = (o: OpportunityRow) =>
      `${(o.title ?? '').trim().toLowerCase()}::${o.account_id ?? ''}`;
    const dupCount = new Map<string, number>();
    opps.forEach((o) => {
      const k = dupKey(o);
      if (!k || k === '::') return;
      dupCount.set(k, (dupCount.get(k) ?? 0) + 1);
    });
    const isDuplicate = (o: OpportunityRow) =>
      (dupCount.get(dupKey(o)) ?? 0) > 1;

    const issueBuckets: Record<PipelineIssueId, OpportunityRow[]> = {
      no_owner: [],
      no_value: [],
      no_next_activity: [],
      stale: [],
      overdue: [],
      duplicate: [],
      no_account: [],
      no_contact: [],
    };

    const oppIssues = new Map<string, PipelineIssueId[]>();

    for (const o of opps) {
      const tags: PipelineIssueId[] = [];
      if (!o.owner_user_id) tags.push('no_owner');
      const val = Number(o.valor_previsto ?? 0);
      if (!o.valor_previsto || val <= 0) tags.push('no_value');
      if (!o.next_followup_date) tags.push('no_next_activity');

      const updated = o.updated_at ? new Date(o.updated_at).getTime() : 0;
      if (updated && now - updated > STALE_MS) tags.push('stale');

      if (o.close_date_prevista) {
        const due = new Date(o.close_date_prevista).getTime();
        if (due < now) tags.push('overdue');
      }
      if (!o.account_id) tags.push('no_account');
      if (!o.contact_id) tags.push('no_contact');
      if (isDuplicate(o)) tags.push('duplicate');

      tags.forEach((t) => issueBuckets[t].push(o));
      if (tags.length) oppIssues.set(o.id, tags);
    }

    // ── Trust Score
    let penalty = 0;
    (Object.keys(issueBuckets) as PipelineIssueId[]).forEach((k) => {
      penalty += issueBuckets[k].length * ISSUE_WEIGHT[k];
    });
    const totalOpen = opps.length;
    const trustScore = Math.max(
      0,
      Math.min(100, totalOpen === 0 ? 100 : Math.round(100 - penalty / Math.max(1, totalOpen) * 10)),
    );

    const issues: CriticalIssue[] = (
      Object.keys(issueBuckets) as PipelineIssueId[]
    ).map((id) => ({
      id,
      label: ISSUE_LABEL[id],
      count: issueBuckets[id].length,
      value: issueBuckets[id].reduce(
        (s, o) => s + (Number(o.valor_previsto) || 0),
        0,
      ),
      opportunityIds: issueBuckets[id].map((o) => o.id),
    }));

    // ── Dinheiro em risco
    const moneyAtRisk = {
      noActivityValue: issueBuckets.no_next_activity.reduce(
        (s, o) => s + (Number(o.valor_previsto) || 0),
        0,
      ),
      overdueValue: issueBuckets.overdue.reduce(
        (s, o) => s + (Number(o.valor_previsto) || 0),
        0,
      ),
      staleValue: issueBuckets.stale.reduce(
        (s, o) => s + (Number(o.valor_previsto) || 0),
        0,
      ),
    };

    // ── Saúde por etapa
    const stageGroups = new Map<string, OpportunityRow[]>();
    for (const o of opps) {
      const id = o.stage_id ?? '__none__';
      if (!stageGroups.has(id)) stageGroups.set(id, []);
      stageGroups.get(id)!.push(o);
    }
    const stages: StageHealth[] = Array.from(stageGroups.entries())
      .map(([stageId, rows]) => {
        const ages = rows
          .map((r) =>
            r.updated_at
              ? (now - new Date(r.updated_at).getTime()) / 86_400_000
              : null,
          )
          .filter((d): d is number => d != null);
        const avgAgeDays =
          ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
        const health: StageHealth['health'] =
          avgAgeDays < 7 ? 'green' : avgAgeDays < 21 ? 'yellow' : 'red';
        const stageInfo = stagesMap.get(stageId);
        return {
          stageId,
          stageName: stageInfo?.name ?? 'Sem etapa',
          count: rows.length,
          value: rows.reduce(
            (s, r) => s + (Number(r.valor_previsto) || 0),
            0,
          ),
          avgAgeDays,
          health,
        };
      })
      .sort((a, b) => {
        const oa = stagesMap.get(a.stageId)?.order ?? 999;
        const ob = stagesMap.get(b.stageId)?.order ?? 999;
        return oa - ob;
      });

    // ── Ranking de higiene
    const byOwner = new Map<string, OpportunityRow[]>();
    for (const o of opps) {
      const id = o.owner_user_id ?? '__none__';
      if (!byOwner.has(id)) byOwner.set(id, []);
      byOwner.get(id)!.push(o);
    }
    const ranking: HygieneRanking[] = Array.from(byOwner.entries())
      .filter(([id]) => id !== '__none__')
      .map(([ownerId, rows]) => {
        let p = 0;
        rows.forEach((r) => {
          const tags = oppIssues.get(r.id) ?? [];
          tags.forEach((t) => (p += ISSUE_WEIGHT[t]));
        });
        const score = Math.max(
          0,
          Math.min(100, Math.round(100 - (p / Math.max(1, rows.length)) * 10)),
        );
        const prof = profilesMap.get(ownerId);
        return {
          ownerId,
          ownerName: prof?.name ?? 'Sem nome',
          avatarUrl: prof?.avatar_url ?? null,
          total: rows.length,
          issues: rows.filter((r) => (oppIssues.get(r.id) ?? []).length > 0)
            .length,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    // ── Diagnóstico executivo (sem IA)
    const sorted = [...issues].filter((i) => i.count > 0).sort(
      (a, b) => b.count * ISSUE_WEIGHT[b.id] - a.count * ISSUE_WEIGHT[a.id],
    );
    const top = sorted.slice(0, 3);
    const intro =
      trustScore >= 90
        ? 'O pipeline apresenta excelente confiabilidade.'
        : trustScore >= 80
          ? 'O pipeline apresenta boa confiabilidade.'
          : trustScore >= 70
            ? 'O pipeline apresenta sinais de atenção.'
            : 'O pipeline apresenta nível crítico de confiabilidade.';
    const bullets = top
      .map((t) => `• ${t.count} ${t.label.toLowerCase()}`)
      .join('\n');
    const outro =
      top.length > 0
        ? 'Esses itens representam risco de forecast e perda de produtividade.'
        : 'Nenhum problema crítico relevante detectado.';
    const diagnosis = `${intro}${top.length ? `\n\nOs maiores riscos atuais são:\n${bullets}\n\n${outro}` : ` ${outro}`}`;

    // ── Ações recomendadas
    const actions: RecommendedAction[] = [];
    const pushAction = (
      issue: PipelineIssueId,
      priority: RecommendedAction['priority'],
      verb: string,
    ) => {
      const bucket = issues.find((i) => i.id === issue);
      if (!bucket || bucket.count === 0) return;
      actions.push({
        id: `action_${issue}`,
        priority,
        title: `${verb} ${bucket.count} ${bucket.label.toLowerCase()}.`,
        impactValue: bucket.value,
        count: bucket.count,
        filterIssue: issue,
      });
    };
    pushAction('overdue', 'high', 'Corrigir');
    pushAction('duplicate', 'high', 'Resolver');
    pushAction('no_next_activity', 'medium', 'Atualizar');
    pushAction('stale', 'medium', 'Reativar');
    pushAction('no_value', 'medium', 'Preencher valor de');
    pushAction('no_owner', 'low', 'Atribuir owner em');
    pushAction('no_account', 'low', 'Vincular empresa em');
    pushAction('no_contact', 'low', 'Vincular contato em');

    const data: PipelineHealthData = {
      trustScore,
      trustLabel: trustLabel(trustScore),
      totalOpen,
      totalOpenValue: opps.reduce(
        (s, o) => s + (Number(o.valor_previsto) || 0),
        0,
      ),
      diagnosis,
      issues,
      moneyAtRisk,
      stages,
      ranking,
      actions,
      scope,
      meta: { generatedAt: new Date().toISOString() },
    };

    return { data, isLoading: query.isLoading, error: null };
  }, [
    orgId,
    pipelineResolved,
    salesPipelineId,
    salesPipelineName,
    query.data,
    query.isLoading,
    query.error,
  ]);
}

export { ISSUE_LABEL, ISSUE_WEIGHT, fmtBRL };
