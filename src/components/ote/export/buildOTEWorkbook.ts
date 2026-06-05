/**
 * Sprint OTE 1.4 — Excel Auditável do Relatório OTE.
 *
 * Este builder gera um arquivo Excel que é réplica auditável da tela
 * Resultados → OTE. Usado como documento de prova para fechamento de
 * remuneração variável, comissões, OTE, metas, rescisões e auditoria.
 *
 * Fontes obrigatórias (mesmas da tela):
 *  - Closers: commercial_won_revenue_historical_view via revenueSsotService.
 *  - Vendas / Itens: ote_sales_records + ote_sales_record_items (já carregados
 *    em records).
 *  - Pré-vendas: getHistoricalQualifiersInPeriod (mesma regra do contador).
 *  - Qualificações: getQualifiedOpportunitiesByUser (mesma regra do drilldown).
 *
 * Valores monetários são exportados como números com formato R$.
 * Datas/horas são exportadas como Date com format adequado.
 * Percentuais são exportados como número/100 com format %.
 */
import * as XLSX from 'xlsx';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { resolveEligibleAmounts } from '@/components/ote/oteEligibility';
import { revenueSsotService } from '@/services/revenue/revenueSsotService';
import {
  getHistoricalQualifiersInPeriod,
  getQualifiedOpportunitiesByUser,
  type QualifiedOpportunity,
} from '@/services/results/historicalQualifications';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FMT_BRL = '"R$" #,##0.00;[Red]"R$" -#,##0.00;"-"';
const FMT_PCT = '0.0%';
const FMT_INT = '#,##0;-#,##0;"-"';
const FMT_DATE = 'dd/mm/yyyy';
const FMT_TIME = 'hh:mm';
const FMT_DATETIME = 'dd/mm/yyyy hh:mm';

type ColumnFormat = 'brl' | 'pct' | 'int' | 'date' | 'time' | 'datetime' | 'text';

interface ColumnDef {
  header: string;
  format?: ColumnFormat;
  width?: number;
}

const REVENUE_LEVEL_RE = /closer|executor|rainmaker|dealmaker|strategic/i;
const LEADS_LEVEL_RE = /sdr|pré|pre|hunter|scout|bdr|sniper/i;

function isRevenueRole(r: OTEMonthlyResult): boolean {
  const level = `${r.level_name_snapshot ?? ''} ${(r as any).ote_level?.level_code ?? ''}`;
  return (r.goal_type || 'revenue') === 'revenue' && !r.is_team_target && REVENUE_LEVEL_RE.test(level);
}

function isPreSalesRole(r: OTEMonthlyResult): boolean {
  const level = `${r.level_name_snapshot ?? ''} ${(r as any).ote_level?.level_code ?? ''}`;
  return r.goal_type === 'leads' && !r.is_team_target && LEADS_LEVEL_RE.test(level);
}

function toDate(iso?: string | null): Date | '' {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d;
}

function revenueType(r: OTESalesRecord): string {
  const mrr = Number(r.mrr_amount) || 0;
  const one = Number(r.one_shot_amount) || 0;
  if (mrr > 0 && one > 0) return 'Misto';
  if (mrr > 0) return 'MRR';
  if (one > 0) return 'One-shot';
  return '-';
}

function periodLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number);
  if (!y || !m) return periodMonth;
  const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${names[m - 1]} ${y}`;
}

function periodRange(periodMonth: string): { start: string; end: string } {
  const [y, m] = periodMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1) - 1).toISOString();
  return { start, end };
}

function buildSheet(columns: ColumnDef[], rows: any[][]): XLSX.WorkSheet {
  const aoa = [columns.map((c) => c.header), ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const range = XLSX.utils.decode_range(ws['!ref']!);

  // Column formats
  for (let c = 0; c <= range.e.c; c++) {
    const col = columns[c];
    if (!col?.format) continue;
    const z =
      col.format === 'brl' ? FMT_BRL
      : col.format === 'pct' ? FMT_PCT
      : col.format === 'int' ? FMT_INT
      : col.format === 'date' ? FMT_DATE
      : col.format === 'time' ? FMT_TIME
      : col.format === 'datetime' ? FMT_DATETIME
      : undefined;
    if (!z) continue;
    for (let r = 1; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.v !== '' && cell.v != null) cell.z = z;
    }
  }

  // Bold header (best-effort; xlsx community ignora estilos sem styles plugin,
  // mas o formato e freeze panes/autofilter funcionam).
  for (let c = 0; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell) cell.s = { font: { bold: true } };
  }

  // Column widths
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(12, Math.min(48, c.width ?? (c.header.length + 4))) }));

  // Freeze first row + autofilter
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }) };
  (ws as any)['!views'] = [{ state: 'frozen', ySplit: 1 }];

  return ws;
}

function buildKeyValueSheet(rows: Array<[string, any, ColumnFormat?]>): XLSX.WorkSheet {
  const aoa: any[][] = [['Indicador', 'Valor'], ...rows.map(([k, v]) => [k, v])];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  // Apply formats per row
  rows.forEach(([, , fmt], i) => {
    if (!fmt) return;
    const z =
      fmt === 'brl' ? FMT_BRL
      : fmt === 'pct' ? FMT_PCT
      : fmt === 'int' ? FMT_INT
      : fmt === 'date' ? FMT_DATE
      : fmt === 'time' ? FMT_TIME
      : fmt === 'datetime' ? FMT_DATETIME
      : undefined;
    if (!z) return;
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
    const cell = ws[addr];
    if (cell && cell.v != null && cell.v !== '') cell.z = z;
  });
  ws['!cols'] = [{ wch: 36 }, { wch: 32 }];
  (ws as any)['!views'] = [{ state: 'frozen', ySplit: 1 }];
  return ws;
}

// ---------------------------------------------------------------------------
// Async data assembly
// ---------------------------------------------------------------------------

interface BuildArgs {
  periodMonth: string;
  organizationId?: string;
  organizationName?: string;
  exporterName?: string;
  results: OTEMonthlyResult[];
  records: OTESalesRecord[];
  modeLabel?: string;
}

interface AssembledData {
  ssotSummary: { eligible: number } | null;
  histBySeller: Map<string, { total: number; name: string; source?: string | null; confidence?: string | null }>;
  histQualifiers: Map<string, number>;
  qualifiedByUser: Map<string, QualifiedOpportunity[]>;
  activeUserIds: Set<string>;
  profileNameMap: Map<string, string>;
}

async function assembleData(args: BuildArgs): Promise<AssembledData> {
  const { start, end } = periodRange(args.periodMonth);
  const empty: AssembledData = {
    ssotSummary: null,
    histBySeller: new Map(),
    histQualifiers: new Map(),
    qualifiedByUser: new Map(),
    activeUserIds: new Set(),
    profileNameMap: new Map(),
  };
  if (!args.organizationId) return empty;

  const ssotParams = { organizationId: args.organizationId, start, end } as any;

  const [summary, bySeller, qualifiers, activeRows] = await Promise.all([
    revenueSsotService.getOfficialEligibleRevenueSummary(ssotParams).catch(() => null),
    revenueSsotService.getOfficialHistoricalRevenueBySeller(ssotParams).catch(() => []),
    getHistoricalQualifiersInPeriod({ organizationId: args.organizationId, start, end }).catch(() => []),
    (supabase as any)
      .from('crm_active_users_view')
      .select('user_id, full_name')
      .eq('tenant_id', args.organizationId)
      .then((r: any) => r.data ?? []),
  ]);

  const histBySeller = new Map(
    (bySeller ?? []).map((g: any) => [g.key, {
      total: g.total,
      name: g.label,
      source: g.attributionSource ?? null,
      confidence: g.attributionConfidence ?? null,
    }]),
  );
  const histQualifiers = new Map((qualifiers ?? []).map((q) => [q.qualifierUserId, q.qualifiedLeads]));

  // Buscar qualificações detalhadas para cada usuário com leads
  const qualifiedByUser = new Map<string, QualifiedOpportunity[]>();
  await Promise.all(
    Array.from(histQualifiers.keys()).map(async (uid) => {
      try {
        const opps = await getQualifiedOpportunitiesByUser({
          organizationId: args.organizationId!,
          userId: uid,
          start,
          end,
        });
        qualifiedByUser.set(uid, opps);
      } catch {
        qualifiedByUser.set(uid, []);
      }
    }),
  );

  const activeUserIds = new Set<string>((activeRows ?? []).map((u: any) => u.user_id));
  const profileNameMap = new Map<string, string>(
    (activeRows ?? []).map((u: any) => [u.user_id, u.full_name as string]),
  );

  // Garantir nomes dos usuários referenciados (mesmo inativos) via profiles
  const referencedIds = new Set<string>();
  for (const r of args.results) referencedIds.add(r.user_id);
  for (const [uid] of histBySeller) if (uid !== '__pending__') referencedIds.add(uid);
  for (const [uid] of histQualifiers) referencedIds.add(uid);
  for (const opps of qualifiedByUser.values()) {
    for (const o of opps) {
      if (o.historicalQualifierUserId) referencedIds.add(o.historicalQualifierUserId);
      if (o.currentOwnerUserId) referencedIds.add(o.currentOwnerUserId);
    }
  }
  const missing = Array.from(referencedIds).filter((id) => !profileNameMap.has(id));
  if (missing.length > 0) {
    const { data: profs } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .in('id', missing);
    for (const p of (profs ?? []) as any[]) {
      if (p.full_name) profileNameMap.set(p.id, p.full_name);
    }
  }

  return {
    ssotSummary: summary ? { eligible: Number(summary.eligible || 0) } : null,
    histBySeller,
    histQualifiers,
    qualifiedByUser,
    activeUserIds,
    profileNameMap,
  };
}

function userStatus(uid: string, activeUserIds: Set<string>): string {
  return activeUserIds.has(uid) ? 'Ativo' : 'Inativo';
}

function nameOf(uid: string | null | undefined, fallback: string | null | undefined, data: AssembledData): string {
  if (!uid) return fallback || '—';
  return data.profileNameMap.get(uid) || fallback || uid.slice(0, 8) + '...';
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildOTEWorkbook(args: BuildArgs): Promise<XLSX.WorkBook> {
  const data = await assembleData(args);
  const wb = XLSX.utils.book_new();

  const generatedAt = new Date();
  const closers = args.results.filter(isRevenueRole);
  const sdrs = args.results.filter(isPreSalesRole);
  const resultByUser = new Map(args.results.map((r) => [r.user_id, r]));
  const resultById = new Map(args.results.map((r) => [r.id, r]));

  // Vendas dos closers (records vinculados a um ote_result de closer)
  const closerResultIds = new Set(closers.map((r) => r.id));
  const saleRecords = args.records.filter((r) => r.record_kind !== 'qualified_lead' && closerResultIds.has(r.ote_result_id));

  // Totais agregados (usados em validações)
  const ssotEligible = data.ssotSummary?.eligible ?? 0;
  const oteEligibleTotal = saleRecords.reduce((s, r) => s + resolveEligibleAmounts(r).eligible, 0);
  const itemsOutOfGoal = Math.max(0, ssotEligible - oteEligibleTotal);
  const totalToPay = args.results.reduce((s, r) => s + Number(r.final_variable_amount || 0), 0);
  const blueFlags = args.results.filter((r) => r.flag_color === 'blue').length;
  const yellowFlags = args.results.filter((r) => r.flag_color === 'yellow').length;
  const redFlags = args.results.filter((r) => r.flag_color === 'red').length;

  // Closers/pre-sales presentes no Excel (configurados + sintéticos)
  const syntheticCloserUids = Array.from(data.histBySeller.entries())
    .filter(([uid, v]) => uid !== '__pending__' && (v.total ?? 0) > 0 && !closers.some((c) => c.user_id === uid))
    .map(([uid]) => uid);
  const syntheticSdrUids = Array.from(data.histQualifiers.entries())
    .filter(([uid, n]) => n > 0 && !sdrs.some((s) => s.user_id === uid) && !closers.some((c) => c.user_id === uid))
    .map(([uid]) => uid);

  const closersCount = closers.length + syntheticCloserUids.length;
  const sdrsCount = sdrs.length + syntheticSdrUids.length;

  // -------------------------------------------------------------------------
  // Aba 1 — Resumo OTE
  // -------------------------------------------------------------------------
  const wsResumo = buildKeyValueSheet([
    ['Organização', args.organizationName || '—'],
    ['Período', periodLabel(args.periodMonth)],
    ['Data/hora de geração', generatedAt, 'datetime'],
    ['Modo do sistema de metas', args.modeLabel || 'Sistema OTE Completo'],
    ['Status do cálculo', args.results.length > 0 ? 'Calculado' : 'Pendente'],
    ['Calculado em',
      args.results[0]?.calculated_at ? toDate(args.results[0].calculated_at) : '',
      'datetime'],
    ['Total a pagar', totalToPay, 'brl'],
    ['Comissão elegível comercial', ssotEligible, 'brl'],
    ['Receita elegível OTE', oteEligibleTotal, 'brl'],
    ['Itens fora da meta', itemsOutOfGoal, 'brl'],
    ['Vendedores no cálculo', args.results.length, 'int'],
    ['Closers no cálculo', closersCount, 'int'],
    ['Pré-vendas no cálculo', sdrsCount, 'int'],
    ['Alta performance (Blue)', blueFlags, 'int'],
    ['Zona de atenção (Yellow)', yellowFlags, 'int'],
    ['Abaixo do mínimo (Red)', redFlags, 'int'],
    ['Exportado por', args.exporterName || '—'],
  ]);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo OTE');

  // -------------------------------------------------------------------------
  // Aba 2 — Closers
  // -------------------------------------------------------------------------
  const closerColumns: ColumnDef[] = [
    { header: 'Vendedor', width: 28 },
    { header: 'Status do usuário', width: 14 },
    { header: 'Nível', width: 18 },
    { header: 'Meta em R$', format: 'brl' },
    { header: 'Comissão elegível comercial', format: 'brl', width: 22 },
    { header: 'Receita elegível OTE', format: 'brl', width: 22 },
    { header: 'Itens fora da meta', format: 'brl' },
    { header: '% Meta', format: 'pct' },
    { header: 'Multiplicador', width: 12 },
    { header: 'Variável base', format: 'brl' },
    { header: 'Acelerador %', format: 'pct' },
    { header: 'Desacelerador %', format: 'pct' },
    { header: 'Ajuste final', format: 'pct' },
    { header: 'Variável final', format: 'brl' },
    { header: 'Flag', width: 10 },
    { header: 'Qtd. vendas válidas', format: 'int' },
    { header: 'Responsável histórico preservado?', width: 18 },
    { header: 'Fonte de atribuição', width: 22 },
    { header: 'Confiança da atribuição', width: 18 },
    { header: 'Calculado em', format: 'datetime', width: 18 },
  ];

  const closerRows: any[][] = [];
  for (const r of closers) {
    const commercial = data.histBySeller.get(r.user_id)?.total ?? 0;
    const recs = saleRecords.filter((rec) => rec.ote_result_id === r.id);
    const elig = recs.reduce((s, rec) => s + resolveEligibleAmounts(rec).eligible, 0);
    const out = Math.max(0, commercial - elig);
    const src = data.histBySeller.get(r.user_id);
    closerRows.push([
      nameOf(r.user_id, r.profile?.full_name, data),
      userStatus(r.user_id, data.activeUserIds),
      r.level_name_snapshot || '—',
      Number(r.goal_amount || 0),
      commercial,
      elig,
      out,
      Number(r.goal_amount || 0) > 0 ? elig / Number(r.goal_amount) : 0,
      `${r.ote_multiplier}x`,
      Number(r.base_variable || 0),
      Number(r.total_accelerator_percentage || 0) / 100,
      Number(r.total_decelerator_percentage || 0) / 100,
      Number(r.final_adjustment_percentage || 0) / 100,
      Number(r.final_variable_amount || 0),
      r.flag_color || '—',
      recs.length,
      'Sim',
      src?.source || 'opportunity_owner_history',
      src?.confidence || 'high',
      toDate(r.calculated_at),
    ]);
  }
  // Sintéticos: closers históricos com receita mas sem ote_result
  for (const uid of syntheticCloserUids) {
    const v = data.histBySeller.get(uid)!;
    closerRows.push([
      nameOf(uid, v.name, data),
      userStatus(uid, data.activeUserIds),
      'Sem nível OTE',
      0,
      v.total,
      0,
      v.total,
      0,
      '—',
      0,
      0,
      0,
      0,
      0,
      '—',
      0,
      'Sim',
      v.source || 'opportunity_owner_history',
      v.confidence || 'high',
      '',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, buildSheet(closerColumns, closerRows), 'Closers');

  // -------------------------------------------------------------------------
  // Aba 3 — Vendas Closers
  // -------------------------------------------------------------------------
  const vendasColumns: ColumnDef[] = [
    { header: 'Vendedor histórico', width: 26 },
    { header: 'Status do vendedor', width: 14 },
    { header: 'Cliente / Empresa', width: 30 },
    { header: 'Oportunidade', width: 16 },
    { header: 'Proposta', width: 14 },
    { header: 'Pipeline', width: 18 },
    { header: 'Data de fechamento', format: 'date' },
    { header: 'Hora de fechamento', format: 'time' },
    { header: 'Data/hora de fechamento', format: 'datetime', width: 20 },
    { header: 'Valor comercial da venda', format: 'brl' },
    { header: 'Valor elegível para meta', format: 'brl' },
    { header: 'Valor fora da meta', format: 'brl' },
    { header: 'Tipo', width: 10 },
    { header: 'Status da venda', width: 14 },
    { header: 'Status entrega', width: 14 },
    { header: 'Status financeiro', width: 14 },
    { header: 'Comissão elegível?', width: 12 },
    { header: 'Venda cancelada?', width: 12 },
    { header: 'Venda reaberta/perdida?', width: 14 },
    { header: 'Motivo de exclusão', width: 28 },
    { header: 'Responsável histórico', width: 22 },
    { header: 'Responsável atual', width: 22 },
    { header: 'Transferido?', width: 12 },
    { header: 'Fonte de atribuição', width: 22 },
    { header: 'Confiança da atribuição', width: 16 },
    { header: 'Link da oportunidade', width: 38 },
  ];

  const vendasRows: any[][] = [];
  for (const rec of saleRecords) {
    const owner = resultById.get(rec.ote_result_id);
    const histUid = owner?.user_id;
    const histName = nameOf(histUid, owner?.profile?.full_name, data);
    const splits = resolveEligibleAmounts(rec);
    const sale = Number(rec.sale_value || 0);
    const eligible = splits.eligible;
    const nonEligible = Math.max(0, sale - eligible);
    const cancelled = rec.payment_status?.toLowerCase?.().includes('cancel');
    const lost = !rec.counts_toward_goal && (rec.exclusion_reason || '').toLowerCase().includes('perd');
    const dt = toDate(rec.closed_at || rec.sale_date);
    const src = histUid ? data.histBySeller.get(histUid) : undefined;
    vendasRows.push([
      histName,
      histUid ? userStatus(histUid, data.activeUserIds) : '—',
      rec.client_name,
      rec.opportunity_id || '—',
      rec.proposal_number || '—',
      rec.pipeline_name || '—',
      dt, dt, dt,
      sale,
      eligible,
      nonEligible,
      revenueType(rec),
      rec.payment_status || '—',
      (rec as any).fulfillment_status || '—',
      (rec as any).financial_settlement_status || rec.payment_status || '—',
      rec.counts_toward_goal ? 'Sim' : 'Não',
      cancelled ? 'Sim' : 'Não',
      lost ? 'Sim' : 'Não',
      rec.exclusion_reason || '',
      histName,
      histName, // Mesma fonte é o responsável atual aqui (record já consolidado).
      'Não',
      src?.source || 'opportunity_owner_history',
      src?.confidence || 'high',
      rec.opportunity_id ? `${window.location.origin}/app/opportunities/${rec.opportunity_id}` : '',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, buildSheet(vendasColumns, vendasRows), 'Vendas Closers');

  // -------------------------------------------------------------------------
  // Aba 4 — Itens das Vendas
  // -------------------------------------------------------------------------
  const itensColumns: ColumnDef[] = [
    { header: 'Vendedor histórico', width: 26 },
    { header: 'Cliente / Empresa', width: 30 },
    { header: 'Oportunidade', width: 16 },
    { header: 'Proposta', width: 14 },
    { header: 'Data de fechamento', format: 'date' },
    { header: 'Hora de fechamento', format: 'time' },
    { header: 'Produto / Serviço', width: 28 },
    { header: 'Categoria', width: 16 },
    { header: 'Tipo', width: 12 },
    { header: 'Quantidade', format: 'int' },
    { header: 'Valor unitário', format: 'brl' },
    { header: 'Valor total do item', format: 'brl' },
    { header: 'Contabiliza na meta?', width: 14 },
    { header: 'Valor elegível do item', format: 'brl' },
    { header: 'Valor fora da meta do item', format: 'brl' },
    { header: 'Motivo de exclusão do item', width: 30 },
    { header: 'Status do produto/serviço', width: 18 },
    { header: 'Regra aplicada', width: 24 },
    { header: 'Responsável histórico da venda', width: 22 },
    { header: 'Responsável atual da venda', width: 22 },
    { header: 'Transferido?', width: 12 },
    { header: 'Link da oportunidade', width: 38 },
  ];

  const itensRows: any[][] = [];
  for (const rec of saleRecords) {
    const owner = resultById.get(rec.ote_result_id);
    const histName = nameOf(owner?.user_id, owner?.profile?.full_name, data);
    const dt = toDate(rec.closed_at || rec.sale_date);
    const items = rec.items || [];
    if (items.length === 0) {
      // Sem itens: registra linha consolidada para auditoria
      const elig = resolveEligibleAmounts(rec).eligible;
      const total = Number(rec.sale_value || 0);
      itensRows.push([
        histName,
        rec.client_name,
        rec.opportunity_id || '—',
        rec.proposal_number || '—',
        dt, dt,
        'Venda sem detalhamento de itens',
        '—',
        revenueType(rec),
        1,
        total,
        total,
        elig > 0 ? 'Sim' : 'Não',
        elig,
        Math.max(0, total - elig),
        rec.exclusion_reason || (elig > 0 ? '' : 'Valor cheio sem detalhe item-a-item'),
        '—',
        'Valor cheio considerado para meta',
        histName,
        histName,
        'Não',
        rec.opportunity_id ? `${window.location.origin}/app/opportunities/${rec.opportunity_id}` : '',
      ]);
      continue;
    }
    for (const it of items) {
      const line = Number(it.line_amount || 0);
      const qty = Number(it.quantity || 1) || 1;
      const unit = qty > 0 ? line / qty : line;
      const elig = it.counts_toward_goal ? line : 0;
      const out = it.counts_toward_goal ? 0 : line;
      const motivo = it.counts_toward_goal
        ? ''
        : (it.exclusion_reason || 'Produto/serviço não contabiliza para meta');
      itensRows.push([
        histName,
        rec.client_name,
        rec.opportunity_id || '—',
        rec.proposal_number || '—',
        dt, dt,
        it.product_name || '—',
        (it as any).category || '—',
        ((it.billing_type || '').toLowerCase() === 'recurring' ? 'Recorrente' : 'One-shot'),
        qty,
        unit,
        line,
        it.counts_toward_goal ? 'Sim' : 'Não',
        elig,
        out,
        motivo,
        '—',
        it.counts_toward_goal ? 'Conta para meta' : 'Excluído por configuração de produto',
        histName,
        histName,
        'Não',
        rec.opportunity_id ? `${window.location.origin}/app/opportunities/${rec.opportunity_id}` : '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, buildSheet(itensColumns, itensRows), 'Itens das Vendas');

  // -------------------------------------------------------------------------
  // Aba 5 — Pré-vendas
  // -------------------------------------------------------------------------
  const sdrColumns: ColumnDef[] = [
    { header: 'Pré-venda histórico', width: 28 },
    { header: 'Status do usuário', width: 14 },
    { header: 'Nível', width: 18 },
    { header: 'Meta de leads', format: 'int' },
    { header: 'Leads qualificados', format: 'int' },
    { header: '% Meta', format: 'pct' },
    { header: 'Multiplicador', width: 12 },
    { header: 'Variável base', format: 'brl' },
    { header: 'Acelerador %', format: 'pct' },
    { header: 'Desacelerador %', format: 'pct' },
    { header: 'Ajuste final', format: 'pct' },
    { header: 'Variável final', format: 'brl' },
    { header: 'Flag', width: 10 },
    { header: 'Fonte de atribuição', width: 28 },
    { header: 'Confiança da atribuição', width: 16 },
    { header: 'Calculado em', format: 'datetime', width: 18 },
  ];

  const sdrRows: any[][] = [];
  for (const r of sdrs) {
    const hist = data.histQualifiers.get(r.user_id);
    const qualified = typeof hist === 'number' ? hist : Number(r.total_sales || 0);
    sdrRows.push([
      nameOf(r.user_id, r.profile?.full_name, data),
      userStatus(r.user_id, data.activeUserIds),
      r.level_name_snapshot || '—',
      Number(r.goal_amount || 0),
      qualified,
      Number(r.goal_amount || 0) > 0 ? qualified / Number(r.goal_amount) : 0,
      `${r.ote_multiplier}x`,
      Number(r.base_variable || 0),
      Number(r.total_accelerator_percentage || 0) / 100,
      Number(r.total_decelerator_percentage || 0) / 100,
      Number(r.final_adjustment_percentage || 0) / 100,
      Number(r.final_variable_amount || 0),
      r.flag_color || '—',
      'opportunity_qualification_history',
      'high',
      toDate(r.calculated_at),
    ]);
  }
  for (const uid of syntheticSdrUids) {
    const n = data.histQualifiers.get(uid) ?? 0;
    sdrRows.push([
      nameOf(uid, null, data),
      userStatus(uid, data.activeUserIds),
      'Sem nível OTE',
      0,
      n,
      0,
      '—',
      0,
      0,
      0,
      0,
      0,
      '—',
      'opportunity_qualification_history',
      'high',
      '',
    ]);
  }
  XLSX.utils.book_append_sheet(wb, buildSheet(sdrColumns, sdrRows), 'Pré-vendas');

  // -------------------------------------------------------------------------
  // Aba 6 — Qualificações Pré-vendas
  // -------------------------------------------------------------------------
  const qualColumns: ColumnDef[] = [
    { header: 'Pré-venda histórico', width: 26 },
    { header: 'Status do pré-venda', width: 14 },
    { header: 'Cliente / Empresa', width: 30 },
    { header: 'Lead / Oportunidade', width: 30 },
    { header: 'Pipeline', width: 18 },
    { header: 'Origem', width: 16 },
    { header: 'Data da qualificação', format: 'date' },
    { header: 'Hora da qualificação', format: 'time' },
    { header: 'Data/hora da qualificação', format: 'datetime', width: 20 },
    { header: 'Status atual', width: 12 },
    { header: 'Etapa atual', width: 18 },
    { header: 'Responsável histórico pela qualificação', width: 26 },
    { header: 'Responsável atual', width: 22 },
    { header: 'Transferido?', width: 12 },
    { header: 'Virou oportunidade?', width: 14 },
    { header: 'Virou venda?', width: 12 },
    { header: 'Data da venda', format: 'date' },
    { header: 'Valor vendido', format: 'brl' },
    { header: 'Closer da venda', width: 22 },
    { header: 'Fonte de atribuição', width: 28 },
    { header: 'Confiança da atribuição', width: 16 },
    { header: 'Link da oportunidade', width: 38 },
  ];

  const qualRows: any[][] = [];
  // Lista todas as oportunidades de TODOS os pré-vendas (configurados + sintéticos)
  const allSdrUids = new Set<string>([
    ...sdrs.map((r) => r.user_id),
    ...syntheticSdrUids,
  ]);
  for (const uid of allSdrUids) {
    const opps = data.qualifiedByUser.get(uid) || [];
    for (const o of opps) {
      const dt = toDate(o.qualificationAt || o.closedAt);
      const histName = nameOf(uid, o.historicalQualifierName, data);
      const currentName = nameOf(o.currentOwnerUserId, o.currentOwnerName, data);
      const transferred = o.currentOwnerUserId && o.historicalQualifierUserId && o.currentOwnerUserId !== o.historicalQualifierUserId;
      qualRows.push([
        histName,
        userStatus(uid, data.activeUserIds),
        o.accountName || '—',
        o.title || '—',
        o.pipelineName || '—',
        o.origem || '—',
        dt, dt, dt,
        o.status || '—',
        o.stageName || '—',
        histName,
        currentName,
        transferred ? 'Sim' : 'Não',
        'Sim',
        o.valueWon != null && o.valueWon > 0 ? 'Sim' : 'Não',
        toDate(o.closedAt),
        o.valueWon ?? 0,
        '—',
        o.historicalQualifierUserId ? 'opportunity_qualification_history' : 'fallback:owner_user_id',
        o.historicalQualifierUserId ? 'high' : 'medium',
        `${window.location.origin}/app/opportunities/${o.opportunityId}`,
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, buildSheet(qualColumns, qualRows), 'Qualificações Pré-vendas');

  // -------------------------------------------------------------------------
  // Aba 7 — Atribuições Pendentes
  // -------------------------------------------------------------------------
  const pendentesColumns: ColumnDef[] = [
    { header: 'Tipo de registro', width: 18 },
    { header: 'Cliente / Empresa', width: 28 },
    { header: 'Oportunidade', width: 16 },
    { header: 'Proposta', width: 14 },
    { header: 'Data do evento', format: 'datetime', width: 18 },
    { header: 'Valor', format: 'brl' },
    { header: 'Usuário atual', width: 22 },
    { header: 'Responsável histórico identificado', width: 26 },
    { header: 'Problema', width: 36 },
    { header: 'Ação recomendada', width: 36 },
    { header: 'Fonte de atribuição', width: 22 },
    { header: 'Confiança', width: 14 },
  ];
  const pendentesRows: any[][] = [];
  const pendingHist = data.histBySeller.get('__pending__');
  if (pendingHist && pendingHist.total > 0) {
    pendentesRows.push([
      'Receita comercial', '—', '—', '—', '', pendingHist.total, '—', '—',
      'Vendas sem vendedor histórico identificado (opportunity_owner_history vazio).',
      'Preencher opportunity_owner_history para o período.',
      'commercial_won_revenue_historical_view', 'low',
    ]);
  }
  for (const uid of syntheticCloserUids) {
    if (!data.activeUserIds.has(uid)) continue; // inativo já tratado
    const v = data.histBySeller.get(uid)!;
    pendentesRows.push([
      'Closer sem nível OTE', '—', '—', '—', '', v.total, nameOf(uid, v.name, data), nameOf(uid, v.name, data),
      'Usuário com receita histórica mas sem nível OTE configurado para o período.',
      'Configurar nível OTE em Configurações → OTE.',
      v.source || 'opportunity_owner_history', v.confidence || 'high',
    ]);
  }
  for (const uid of syntheticSdrUids) {
    if (!data.activeUserIds.has(uid)) continue;
    const n = data.histQualifiers.get(uid) ?? 0;
    pendentesRows.push([
      'Pré-venda sem nível OTE', '—', '—', '—', '', 0, nameOf(uid, null, data), nameOf(uid, null, data),
      `Usuário com ${n} qualificações no período mas sem nível OTE configurado.`,
      'Configurar nível OTE em Configurações → OTE.',
      'opportunity_qualification_history', 'high',
    ]);
  }
  for (const opps of data.qualifiedByUser.values()) {
    for (const o of opps) {
      if (!o.historicalQualifierUserId && o.currentOwnerUserId) {
        pendentesRows.push([
          'Qualificação', o.accountName || '—', o.opportunityId, '—',
          toDate(o.qualificationAt || o.closedAt), o.valueWon ?? 0,
          nameOf(o.currentOwnerUserId, o.currentOwnerName, data), '—',
          'Sem snapshot em opportunity_qualification_history; atribuição via owner atual.',
          'Registrar qualified_by_user_id em opportunity_qualification_history.',
          'fallback:owner_user_id', 'medium',
        ]);
      }
    }
  }
  if (pendentesRows.length === 0) {
    pendentesRows.push(['—', '—', '—', '—', '', 0, '—', '—', 'Nenhuma atribuição pendente encontrada.', '—', '—', '—']);
  }
  XLSX.utils.book_append_sheet(wb, buildSheet(pendentesColumns, pendentesRows), 'Atribuições Pendentes');

  // -------------------------------------------------------------------------
  // Aba 8 — Regras e Auditoria
  // -------------------------------------------------------------------------
  const rulesRows: Array<[string, any, ColumnFormat?]> = [
    ['Modo do sistema de metas', args.modeLabel || 'Sistema OTE Completo'],
    ['Fonte das vendas realizadas', 'commercial_won_revenue_view (Relatório Vendas Realizadas)'],
    ['Fonte das qualificações', 'opportunities + opportunity_qualification_history (pipeline_type=qualification, status=won, closed_at no período, deleted_at IS NULL)'],
    ['Regra de receita comercial', 'commission_eligible_amount (fallback: valid_revenue_amount). Exclui vendas canceladas, perdidas ou reabertas após aprovação.'],
    ['Regra de receita elegível OTE', 'Receita comercial válida menos itens (produtos/serviços) configurados como não contabilizáveis para meta.'],
    ['Regra de itens fora da meta', 'Itens com counts_toward_goal=false em ote_sales_record_items.'],
    ['Regra de venda cancelada', 'payment_status indicando cancelamento → eligible=0 e venda removida do total comissionável.'],
    ['Regra de proposta reaberta/perdida', 'Quando counts_toward_goal=false com motivo "perdida"/"reaberta", elegível=0.'],
    ['Regra de atribuição histórica (vendedor)', 'commercial_won_revenue_historical_view → seller_id resolvido em opportunity_owner_history no momento do ganho.'],
    ['Regra de atribuição histórica (pré-venda)', 'Primeiro qualified_by_user_id em opportunity_qualification_history; fallback owner_user_id quando não houver histórico.'],
    ['Regra de transferência operacional', 'Transferência de propriedade NÃO altera resultado histórico. Usuários inativos com produção no período aparecem com badge "Inativo".'],
    ['Data/hora de geração', generatedAt, 'datetime'],
    ['Usuário que gerou o relatório', args.exporterName || '—'],
    ['Versão do cálculo', 'Sprint OTE 1.4 — Excel Auditável'],
  ];

  // Validações internas
  const vendasEligibleSum = vendasRows.reduce((s, row) => s + (Number(row[10]) || 0), 0);
  const itensEligibleSum = itensRows.reduce((s, row) => s + (Number(row[13]) || 0), 0);
  const itensOutSum = itensRows.reduce((s, row) => s + (Number(row[14]) || 0), 0);
  const closersFinalSum = closers.reduce((s, r) => s + Number(r.final_variable_amount || 0), 0);
  const sdrsFinalSum = sdrs.reduce((s, r) => s + Number(r.final_variable_amount || 0), 0);

  const divergencias: Array<[string, string, number, number, string]> = [];
  const pushDiv = (tipo: string, desc: string, esperado: number, encontrado: number, sev: string) => {
    if (Math.abs(esperado - encontrado) > 0.01) divergencias.push([tipo, desc, esperado, encontrado, sev]);
  };
  pushDiv('Vendas vs Receita elegível OTE', 'Soma Vendas Closers.Valor elegível = Receita elegível OTE', oteEligibleTotal, vendasEligibleSum, 'alta');
  pushDiv('Itens vs Receita elegível OTE', 'Soma Itens.Valor elegível = Receita elegível OTE', oteEligibleTotal, itensEligibleSum, 'alta');
  pushDiv('Itens fora da meta', 'Soma Itens.Valor fora da meta = Itens fora da meta', itemsOutOfGoal, itensOutSum, 'média');
  pushDiv('Total a pagar', 'Σ Variável final (Closers + Pré-vendas) = Total a pagar', totalToPay, closersFinalSum + sdrsFinalSum, 'alta');

  // Qualificações por usuário vs contador
  for (const uid of allSdrUids) {
    const expected = data.histQualifiers.get(uid) ?? 0;
    const actual = (data.qualifiedByUser.get(uid) || []).length;
    pushDiv(
      'Qualificações por usuário',
      `Resumo vs detalhe para ${nameOf(uid, null, data)}`,
      expected, actual, 'alta',
    );
  }

  rulesRows.push(['', '']);
  rulesRows.push(['Divergências encontradas', divergencias.length, 'int']);

  const wsRules = buildKeyValueSheet(rulesRows);
  XLSX.utils.book_append_sheet(wb, wsRules, 'Regras e Auditoria');

  if (divergencias.length > 0) {
    const divColumns: ColumnDef[] = [
      { header: 'Tipo', width: 24 },
      { header: 'Descrição', width: 48 },
      { header: 'Valor esperado', format: 'brl' },
      { header: 'Valor encontrado', format: 'brl' },
      { header: 'Severidade', width: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, buildSheet(divColumns, divergencias), 'Divergências');
  }

  return wb;
}

// ---------------------------------------------------------------------------
// File naming + download
// ---------------------------------------------------------------------------

function slug(s: string): string {
  return (s || 'organizacao')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function buildOTEFileName(args: { organizationName?: string; periodMonth: string }): string {
  const period = periodLabel(args.periodMonth).replace(' ', '_');
  const org = slug(args.organizationName || 'ORGANIZACAO');
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `Relatorio_OTE_${org}_${period}_gerado_${ts}.xlsx`;
}

export function downloadOTEWorkbook(
  wb: XLSX.WorkBook,
  periodMonth: string,
  organizationName?: string,
) {
  XLSX.writeFile(wb, buildOTEFileName({ organizationName, periodMonth }));
}
