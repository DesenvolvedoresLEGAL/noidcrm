import * as XLSX from 'xlsx';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import type { ResultsMode } from '@/lib/results/resultsMode';
import { buildOTEWorkbook } from '@/components/ote/export/buildOTEWorkbook';
import { buildCommissionWorkbook } from './buildCommissionWorkbook';
import { buildSimpleGoalsWorkbook } from './buildSimpleGoalsWorkbook';

interface DispatchArgs {
  mode: ResultsMode;
  periodMonth: string;
  organizationName?: string;
  exporterName?: string;
  results: OTEMonthlyResult[];
  records: OTESalesRecord[];
}

export function buildResultsWorkbook(args: DispatchArgs): XLSX.WorkBook {
  const { mode, ...rest } = args;
  if (mode === 'standard_commission') return buildCommissionWorkbook(rest);
  if (mode === 'simple_goals') return buildSimpleGoalsWorkbook(rest);
  return buildOTEWorkbook(rest);
}

export function downloadResultsWorkbook(
  wb: XLSX.WorkBook,
  mode: ResultsMode,
  periodMonth: string,
) {
  const prefix = mode === 'standard_commission' ? 'Comissoes' : mode === 'simple_goals' ? 'Metas' : 'OTE';
  XLSX.writeFile(wb, `${prefix}_${periodMonth}.xlsx`);
}
