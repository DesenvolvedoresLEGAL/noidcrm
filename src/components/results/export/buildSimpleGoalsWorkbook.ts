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
    [`Relatório de Metas — ${sheet || ''}`],
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

export function buildSimpleGoalsWorkbook({
  periodMonth,
  organizationName,
  exporterName,
  results,
  records,
}: Args): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const individual = results.filter((r) => !r.is_team_target);
  const resultMap = new Map(individual.map((r) => [r.id, r]));

  let totalGoal = 0;
  let totalRealized = 0;
  let above = 0;
  let below = 0;
  const sellerRows: any[][] = [];
  for (const r of individual) {
    const recs = records.filter((rec) => rec.ote_result_id === r.id);
    const { eligibleTotal } = aggregateEligible(recs);
    const realized = eligibleTotal || Number(r.total_sales || 0);
    const goal = Number(r.goal_amount || 0);
    const pct = goal > 0 ? (realized / goal) * 100 : 0;
    const gap = Math.max(0, goal - realized);
    totalGoal += goal;
    totalRealized += realized;
    const status = goal === 0 ? 'Sem meta configurada' : pct >= 100 ? 'Meta batida' : pct >= 70 ? 'Em ritmo' : 'Abaixo do ritmo';
    if (status === 'Meta batida') above += 1;
    else if (status === 'Em ritmo' || status === 'Abaixo do ritmo') below += 1;
    sellerRows.push([
      r.profile?.full_name || '-',
      fmtBRL(goal),
      fmtBRL(realized),
      `${pct.toFixed(1)}%`,
      fmtBRL(gap),
      status,
    ]);
  }

  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Resumo Metas'),
      ['Indicador', 'Valor'],
      [
        ['Meta total', fmtBRL(totalGoal)],
        ['Receita realizada', fmtBRL(totalRealized)],
        ['% Atingimento', totalGoal > 0 ? `${((totalRealized / totalGoal) * 100).toFixed(1)}%` : '0%'],
        ['Vendedores acima da meta', above],
        ['Vendedores abaixo da meta', below],
      ],
    ),
    'Resumo',
  );

  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Vendedores'),
      ['Vendedor', 'Meta', 'Receita realizada', '% Meta', 'Gap para meta', 'Status'],
      sellerRows,
    ),
    'Vendedores',
  );

  const saleRecords = records.filter((r) => r.record_kind !== 'qualified_lead');
  const salesRows = saleRecords.map((r) => {
    const owner = resultMap.get(r.ote_result_id);
    return [
      owner?.profile?.full_name || '-',
      r.client_name,
      r.proposal_number || '-',
      fmtDateTime(r.closed_at || r.sale_date),
      Number(r.sale_value || 0),
      r.payment_status,
    ];
  });
  XLSX.utils.book_append_sheet(
    wb,
    build(
      header(periodMonth, organizationName, exporterName, 'Vendas'),
      ['Vendedor', 'Cliente', 'Proposta', 'Data', 'Valor realizado', 'Status venda'],
      salesRows,
    ),
    'Vendas',
  );

  return wb;
}
