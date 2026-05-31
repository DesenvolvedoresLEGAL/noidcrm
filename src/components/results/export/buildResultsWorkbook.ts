import * as XLSX from 'xlsx';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import type { ResultsMode } from '@/lib/results/resultsMode';
import { buildOTEWorkbook, downloadOTEWorkbook as downloadOTEAuditableWorkbook } from '@/components/ote/export/buildOTEWorkbook';
import { buildCommissionWorkbook } from './buildCommissionWorkbook';
import { buildSimpleGoalsWorkbook } from './buildSimpleGoalsWorkbook';

interface DispatchArgs {
  mode: ResultsMode;
  periodMonth: string;
  organizationId?: string;
  organizationName?: string;
  exporterName?: string;
  results: OTEMonthlyResult[];
  records: OTESalesRecord[];
}

export async function buildResultsWorkbook(args: DispatchArgs): Promise<XLSX.WorkBook> {
  const { mode, ...rest } = args;
  if (mode === 'standard_commission') return buildCommissionWorkbook(rest);
  if (mode === 'simple_goals') return buildSimpleGoalsWorkbook(rest);
  return buildOTEWorkbook(rest);
}

export function downloadResultsWorkbook(
  wb: XLSX.WorkBook,
  mode: ResultsMode,
  periodMonth: string,
  organizationName?: string,
) {
  if (mode === 'full_ote') {
    downloadOTEAuditableWorkbook(wb, periodMonth, organizationName);
    return;
  }
  const prefix = mode === 'standard_commission' ? 'Comissoes' : 'Metas';
  XLSX.writeFile(wb, `${prefix}_${periodMonth}.xlsx`);
}
