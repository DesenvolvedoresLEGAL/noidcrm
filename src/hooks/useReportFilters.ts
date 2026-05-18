import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ReportFilters {
  pipelines: string[];
  users: string;
  period: string;
  startDate: string;
  endDate: string;
}

export interface ComparativePeriod {
  startDate: string;
  endDate: string;
}

function calculateDatesFromPeriod(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday.toISOString().split('T')[0],
        endDate: yesterday.toISOString().split('T')[0],
      };
    }
    case 'this-week': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    case 'last-week': {
      const startOfLastWeek = new Date(today);
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
      return {
        startDate: startOfLastWeek.toISOString().split('T')[0],
        endDate: endOfLastWeek.toISOString().split('T')[0],
      };
    }
    case 'this-month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    case 'last-month': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: startOfLastMonth.toISOString().split('T')[0],
        endDate: endOfLastMonth.toISOString().split('T')[0],
      };
    }
    case 'last-quarter': {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      let lastQuarterStart: Date;
      let lastQuarterEnd: Date;
      
      if (currentQuarter === 0) {
        // Se estamos no Q1, o trimestre anterior é Q4 do ano passado
        lastQuarterStart = new Date(today.getFullYear() - 1, 9, 1); // Outubro
        lastQuarterEnd = new Date(today.getFullYear() - 1, 11, 31); // Dezembro
      } else {
        // Trimestre anterior do mesmo ano
        lastQuarterStart = new Date(today.getFullYear(), (currentQuarter - 1) * 3, 1);
        lastQuarterEnd = new Date(today.getFullYear(), currentQuarter * 3, 0);
      }
      
      return {
        startDate: lastQuarterStart.toISOString().split('T')[0],
        endDate: lastQuarterEnd.toISOString().split('T')[0],
      };
    }
    case 'this-year': {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: startOfYear.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    default:
      return {
        startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
  }
}

function calculateComparativePeriod(startDate: string, endDate: string): ComparativePeriod {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const compStart = new Date(start);
  compStart.setMonth(compStart.getMonth() - 1);
  
  const compEnd = new Date(compStart);
  compEnd.setDate(compEnd.getDate() + diffDays);
  
  return {
    startDate: compStart.toISOString().split('T')[0],
    endDate: compEnd.toISOString().split('T')[0],
  };
}

export function useReportFilters(initialFilters?: Partial<ReportFilters>) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [filters, setFilters] = useState<ReportFilters>({
    pipelines: initialFilters?.pipelines || [],
    users: initialFilters?.users || 'all',
    period: initialFilters?.period || 'this-month',
    startDate: initialFilters?.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: initialFilters?.endDate || new Date().toISOString().split('T')[0],
  });

  // Calculate effective dates based on period
  const effectiveDates = useMemo(() => {
    if (filters.period === 'custom') {
      return {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    }
    return calculateDatesFromPeriod(filters.period);
  }, [filters.period, filters.startDate, filters.endDate]);

  // Calculate comparative period
  const comparativePeriod = useMemo(() => {
    return calculateComparativePeriod(effectiveDates.startDate, effectiveDates.endDate);
  }, [effectiveDates]);

  const updateFilters = useCallback((newFilters: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const togglePipeline = useCallback((pipelineId: string) => {
    setFilters(prev => ({
      ...prev,
      pipelines: prev.pipelines.includes(pipelineId)
        ? prev.pipelines.filter(p => p !== pipelineId)
        : [...prev.pipelines, pipelineId]
    }));
  }, []);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Invalidate all report queries to force refetch with new filters
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['products-report'] });
      toast.success('Relatório atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsGenerating(false);
    }
  }, [queryClient]);

  return {
    filters,
    effectiveDates,
    comparativePeriod,
    isGenerating,
    updateFilters,
    togglePipeline,
    generateReport,
    setFilters,
  };
}
