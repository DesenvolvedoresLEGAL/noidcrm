import React, { createContext, useContext, ReactNode } from 'react';
import { ReportFilters, ComparativePeriod, useReportFilters } from '@/hooks/useReportFilters';

interface ReportFiltersContextType {
  filters: ReportFilters;
  effectiveDates: { startDate: string; endDate: string };
  comparativePeriod: ComparativePeriod;
  isGenerating: boolean;
  updateFilters: (newFilters: Partial<ReportFilters>) => void;
  togglePipeline: (pipelineId: string) => void;
  generateReport: () => Promise<void>;
  setFilters: React.Dispatch<React.SetStateAction<ReportFilters>>;
}

const ReportFiltersContext = createContext<ReportFiltersContextType | undefined>(undefined);

export function ReportFiltersProvider({ children }: { children: ReactNode }) {
  const reportFilters = useReportFilters();
  
  return (
    <ReportFiltersContext.Provider value={reportFilters}>
      {children}
    </ReportFiltersContext.Provider>
  );
}

export function useReportFiltersContext() {
  const context = useContext(ReportFiltersContext);
  if (!context) {
    throw new Error('useReportFiltersContext must be used within a ReportFiltersProvider');
  }
  return context;
}
