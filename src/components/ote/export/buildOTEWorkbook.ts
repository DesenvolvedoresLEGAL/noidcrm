import * as XLSX from 'xlsx';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';

interface BuildArgs {
  periodMonth: string;
  organizationName?: string;
  exporterName?: string;
  results: OTEMonthlyResult[];
  records: OTESalesRecord[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso || '';
  }
};

function revenueType(r: OTESalesRecord) {
  const mrr = Number(r.mrr_amount) || 0;
  const one = Number(r.one_shot_amount) || 0;
  if (mrr > 0 && one > 0) return 'Misto';
  if (mrr > 0) return 'MRR';
  if (one > 0) return 'One-shot';
  return '-';
}

function headerRows(periodMonth: string, organizationName?: string, exporterName?: string, sheet?: string) {
  return [
    [`Relatório OTE — ${sheet || ''}`],
    [`Período: ${periodMonth}`],
    [`Organização: ${organizationName || '-'}`],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [`Exportado por: ${exporterName || '-'}`],
    [],
  ];
}

function buildSheet(header: any[][], columns: string[], rows: any[][]) {
  const aoa = [...header, columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // best-effort column widths
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(14, Math.min(38, c.length + 2)) }));
  return ws;
}

export function buildOTEWorkbook({
  periodMonth,
  organizationName,
  exporterName,
  results,
  records,
}: BuildArgs): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const closers = results.filter((r) => (r.goal_type || 'revenue') === 'revenue');
  const sdrs = results.filter((r) => r.goal_type === 'leads');
  const resultMap = new Map(results.map((r) => [r.id, r]));

  // 1. Resumo geral
  const totalPagar = results.reduce((s, r) => s + Number(r.final_variable_amount || 0), 0);
  const totalVendas = closers.reduce((s, r) => s + Number(r.total_sales || 0), 0);
  const avgPct =
    results.length > 0
      ? results.reduce((s, r) => s + Number(r.achievement_percentage || 0), 0) / results.length
      : 0;
  const flagCount = (color: string) => results.filter((r) => r.flag_color === color).length;

  const wsResumo = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Resumo geral'),
    ['Indicador', 'Valor'],
    [
      ['Total a pagar', fmtBRL(totalPagar)],
      ['Vendas (Closers)', fmtBRL(totalVendas)],
      ['Média % Meta', `${avgPct.toFixed(1)}%`],
      ['Vendedores', results.length],
      ['Blue flags (≥70%)', flagCount('blue')],
      ['Yellow flags (50–70%)', flagCount('yellow')],
      ['Red flags (<50%)', flagCount('red')],
    ],
  );
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // 2. Closers consolidado
  const closersRows = closers.map((r) => [
    r.profile?.full_name || '-',
    r.level_name_snapshot || '-',
    fmtBRL(Number(r.goal_amount || 0)),
    fmtBRL(Number(r.total_sales || 0)),
    `${Number(r.achievement_percentage || 0).toFixed(1)}%`,
    `${r.ote_multiplier}x`,
    fmtBRL(Number(r.base_variable || 0)),
    `+${r.total_accelerator_percentage}%`,
    `-${r.total_decelerator_percentage}%`,
    `${Number(r.final_adjustment_percentage || 0).toFixed(1)}%`,
    fmtBRL(Number(r.final_variable_amount || 0)),
    r.flag_color || '-',
    r.status,
  ]);
  const wsClosers = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Closers — Consolidado'),
    ['Vendedor', 'Nível', 'Meta', 'Vendas', '% Meta', 'Mult.', 'Base', 'Aceleradores', 'Desaceleradores', 'Ajuste Final', 'Variável Final', 'Flag', 'Status'],
    closersRows,
  );
  XLSX.utils.book_append_sheet(wb, wsClosers, 'Closers');

  // 3. Pré-vendas consolidado
  const sdrRows = sdrs.map((r) => [
    r.profile?.full_name || '-',
    r.level_name_snapshot || '-',
    Number(r.goal_amount || 0),
    Number(r.total_sales || 0),
    `${Number(r.achievement_percentage || 0).toFixed(1)}%`,
    `${r.ote_multiplier}x`,
    fmtBRL(Number(r.base_variable || 0)),
    `+${r.total_accelerator_percentage}%`,
    `-${r.total_decelerator_percentage}%`,
    fmtBRL(Number(r.final_variable_amount || 0)),
    r.flag_color || '-',
    r.status,
  ]);
  const wsSdr = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Pré-vendas — Consolidado'),
    ['Vendedor', 'Nível', 'Meta (leads)', 'Qualificados', '% Meta', 'Mult.', 'Base', 'Aceleradores', 'Desaceleradores', 'Variável Final', 'Flag', 'Status'],
    sdrRows,
  );
  XLSX.utils.book_append_sheet(wb, wsSdr, 'Pré-vendas');

  // 4. Detalhe de vendas — agora com split eligible/non-eligible por venda
  const saleRecords = records.filter((r) => r.record_kind !== 'qualified_lead');
  const detailSales = saleRecords.map((r) => {
    const owner = resultMap.get(r.ote_result_id);
    const sale = Number(r.sale_value || 0);
    const eligible = Number(r.eligible_amount ?? 0);
    const nonEligible = Number(r.non_eligible_amount ?? Math.max(0, sale - eligible));
    return [
      owner?.profile?.full_name || '-',
      r.client_name,
      r.proposal_number || '-',
      r.pipeline_name || '-',
      fmtDateTime(r.closed_at || r.sale_date),
      sale,
      eligible,
      nonEligible,
      revenueType(r),
      r.counts_toward_goal ? 'Conta p/ meta' : 'Fora da meta',
      r.exclusion_reason || '',
    ];
  });
  const wsDetailSales = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Detalhe de vendas (Closers)'),
    ['Vendedor', 'Cliente', 'Proposta', 'Pipeline', 'Fechado em', 'Valor comercial', 'Valor elegível p/ meta', 'Valor fora da meta', 'Tipo', 'Status final', 'Motivo geral'],
    detailSales,
  );
  XLSX.utils.book_append_sheet(wb, wsDetailSales, 'Detalhe Vendas');

  // 4b. Itens da venda — auditoria item a item (produtos/serviços)
  const itemRows: any[] = [];
  for (const r of saleRecords) {
    const owner = resultMap.get(r.ote_result_id);
    const ownerName = owner?.profile?.full_name || '-';
    for (const it of r.items || []) {
      const line = Number(it.line_amount || 0);
      const eligible = it.counts_toward_goal ? line : 0;
      itemRows.push([
        ownerName,
        r.client_name,
        r.proposal_number || '-',
        it.product_name || '—',
        line,
        it.counts_toward_goal ? 'Sim' : 'Não',
        eligible,
        it.exclusion_reason || '',
      ]);
    }
  }
  const wsDetailItems = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Itens da venda'),
    ['Vendedor', 'Cliente', 'Proposta', 'Produto/Serviço', 'Valor do item', 'Contabiliza na meta?', 'Valor elegível do item', 'Motivo de exclusão'],
    itemRows,
  );
  XLSX.utils.book_append_sheet(wb, wsDetailItems, 'Itens da venda');

  // 5. Detalhe de qualificações
  const leadRecords = records.filter((r) => r.record_kind === 'qualified_lead');
  const detailLeads = leadRecords.map((r) => {
    const owner = resultMap.get(r.ote_result_id);
    return [
      owner?.profile?.full_name || '-',
      r.client_name,
      r.pipeline_name || '-',
      fmtDateTime(r.closed_at || r.sale_date),
      r.counts_toward_goal ? 'Sim' : 'Não',
      r.exclusion_reason || '',
    ];
  });
  const wsDetailLeads = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Detalhe de qualificações (SDRs)'),
    ['SDR', 'Cliente', 'Pipeline', 'Qualificado em', 'Conta p/ meta?', 'Motivo exclusão'],
    detailLeads,
  );
  XLSX.utils.book_append_sheet(wb, wsDetailLeads, 'Detalhe Qualificações');

  // 6. Aceleradores / Desaceleradores
  const perfRows = results.map((r) => [
    r.profile?.full_name || '-',
    r.level_name_snapshot || '-',
    r.roleplay_score?.toFixed(1) || '-',
    `${r.roleplay_accelerator > 0 ? '+' : ''}${r.roleplay_accelerator}%`,
    r.crm_completion_score?.toFixed(0) || '-',
    `${r.crm_accelerator > 0 ? '+' : ''}${r.crm_accelerator}%`,
    r.fitscore_avg?.toFixed(0) || '-',
    `${r.fitscore_accelerator > 0 ? '+' : ''}${r.fitscore_accelerator}%`,
    `+${r.total_accelerator_percentage}%`,
    `-${r.total_decelerator_percentage}%`,
    `${Number(r.final_adjustment_percentage || 0).toFixed(1)}%`,
  ]);
  const wsPerf = buildSheet(
    headerRows(periodMonth, organizationName, exporterName, 'Aceleradores / Desaceleradores'),
    ['Vendedor', 'Nível', 'Roleplay Score', 'Roleplay Δ%', 'CRM %', 'CRM Δ%', 'FitScore', 'FitScore Δ%', 'Total Aceleradores', 'Total Desaceleradores', 'Ajuste Final'],
    perfRows,
  );
  XLSX.utils.book_append_sheet(wb, wsPerf, 'Performance');

  return wb;
}

export function downloadOTEWorkbook(wb: XLSX.WorkBook, periodMonth: string) {
  XLSX.writeFile(wb, `OTE_${periodMonth}.xlsx`);
}
