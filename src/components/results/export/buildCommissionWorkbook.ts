import * as XLSX from 'xlsx';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { aggregateEligible } from '@/components/ote/oteEligibility';

interface Args {
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

function header(period: string, org?: string, exporter?: string, sheet?: string) {
  return [
    [`Relatório de Comissões — ${sheet || ''}`],
    [`Período: ${period}`],
    [`Organização: ${org || '-'}`],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [`Exportado por: ${exporter || '-'}`],
    [],
  ];
}

function build(headerRows: any[][], cols: string[], rows: any[][]) {
  const aoa = [...headerRows, cols, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(14, Math.min(38, c.length + 2)) }));
  return ws;
}

export function buildCommissionWorkbook({
  periodMonth,
  organizationName,
  exporterName,
  results,
  records,
}: Args): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const individual = results.filter((r) => !r.is_team_target);
  const resultMap = new Map(individual.map((r) => [r.id, r]));

  let totalCommissionable = 0;
  let totalNonCommissionable = 0;
  let totalGenerated = 0;
  let totalPaid = 0;
  let totalPending = 0;
  const sellerRows: any[][] = [];
  for (const r of individual) {
    const recs = records.filter((rec) => rec.ote_result_id === r.id);
    const { eligibleTotal, nonEligibleTotal } = aggregateEligible(recs);
    const generated = Number(r.final_variable_amount || 0);
    const paid = r.status === 'paid' ? generated : 0;
    const pending = generated - paid;
    totalCommissionable += eligibleTotal;
    totalNonCommissionable += nonEligibleTotal;
    totalGenerated += generated;
    totalPaid += paid;
    totalPending += pending;
    sellerRows.push([
      r.profile?.full_name || '-',
      fmtBRL(eligibleTotal),
      fmtBRL(generated),
      fmtBRL(paid),
      fmtBRL(pending),
      r.status,
    ]);
  }

  // 1. Resumo
  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Resumo Comissão'),
      ['Indicador', 'Valor'],
      [
        ['Comissão a pagar', fmtBRL(totalGenerated)],
        ['Receita comissionável', fmtBRL(totalCommissionable)],
        ['Receita não comissionável', fmtBRL(totalNonCommissionable)],
        ['Comissão paga', fmtBRL(totalPaid)],
        ['Comissão pendente', fmtBRL(totalPending)],
        ['Vendedores com comissão', individual.filter((r) => Number(r.final_variable_amount || 0) > 0).length],
      ],
    ),
    'Resumo',
  );

  // 2. Vendedores
  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Vendedores'),
      ['Vendedor', 'Receita comissionável', 'Comissão calculada', 'Comissão paga', 'Comissão pendente', 'Status'],
      sellerRows,
    ),
    'Vendedores',
  );

  // 3. Vendas
  const saleRecords = records.filter((r) => r.record_kind !== 'qualified_lead');
  const salesRows = saleRecords.map((r) => {
    const owner = resultMap.get(r.ote_result_id);
    const sale = Number(r.sale_value || 0);
    const eligible = Number(r.eligible_amount ?? 0);
    const rate = sale > 0 ? (Number(owner?.final_variable_amount || 0) / sale) * 0 : 0; // not per-sale; left blank
    return [
      owner?.profile?.full_name || '-',
      r.client_name,
      r.proposal_number || '-',
      fmtDateTime(r.closed_at || r.sale_date),
      sale,
      eligible,
      '', // Comissão por venda — depende de regra futura
      owner?.level_name_snapshot || 'Padrão',
      r.payment_status,
      r.counts_toward_goal ? 'Comissionável' : 'Não comissionável',
    ];
  });
  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Vendas'),
      ['Vendedor', 'Cliente', 'Proposta', 'Data', 'Valor comercial', 'Valor comissionável', 'Comissão calculada', 'Regra aplicada', 'Status financeiro', 'Status comissão'],
      salesRows,
    ),
    'Vendas',
  );

  // 4. Itens
  const itemRows: any[] = [];
  for (const r of saleRecords) {
    const owner = resultMap.get(r.ote_result_id);
    for (const it of r.items || []) {
      const line = Number(it.line_amount || 0);
      itemRows.push([
        owner?.profile?.full_name || '-',
        r.client_name,
        r.proposal_number || '-',
        it.product_name || '—',
        line,
        it.counts_toward_goal ? 'Sim' : 'Não',
        it.counts_toward_goal ? line : 0,
        '', // Comissão do item — futuro
        owner?.level_name_snapshot || 'Padrão',
        it.exclusion_reason || '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Itens'),
      ['Vendedor', 'Cliente', 'Proposta', 'Produto/Serviço', 'Valor do item', 'Comissionável?', 'Valor comissionável', 'Comissão do item', 'Regra aplicada', 'Motivo de exclusão'],
      itemRows,
    ),
    'Itens',
  );

  return wb;
}
