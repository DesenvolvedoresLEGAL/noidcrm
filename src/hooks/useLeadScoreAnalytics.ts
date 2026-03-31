import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface LeadScoreFilters {
  grade?: string | null;
  segment?: string | null;
  size?: string | null;
  search?: string;
}

export interface LeadWithScore {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  segmento: string | null;
  tamanho: string | null;
  lead_score: number | null;
  lead_grade: string | null;
  fit_score: number | null;
  intent_score: number | null;
  score_updated_at: string | null;
  owner_user_id: string | null;
  lifecycle_stage: string | null;
  cidade: string | null;
  uf: string | null;
}

export function useLeadScoreAnalytics() {
  const { organization } = useCurrentOrganization();
  const { canViewAll, currentUserId } = useDataVisibility();
  const [filters, setFilters] = useState<LeadScoreFilters>({});

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['lead-score-analytics', organization?.id, canViewAll, currentUserId],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('accounts')
        .select('id, razao_social, nome_fantasia, segmento, tamanho, lead_score, lead_grade, fit_score, intent_score, score_updated_at, owner_user_id, lifecycle_stage, cidade, uf')
        .eq('organization_id', organization.id)
        .is('deleted_at', null)
        .order('lead_score', { ascending: false });

      if (!canViewAll && currentUserId) {
        query = query.eq('owner_user_id', currentUserId);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as LeadWithScore[];
    },
    enabled: !!organization?.id,
    staleTime: 30000,
  });

  // Apply client-side filters
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    
    return leads.filter(lead => {
      if (filters.grade && lead.lead_grade !== filters.grade) return false;
      if (filters.segment && lead.segmento !== filters.segment) return false;
      if (filters.size && lead.tamanho !== filters.size) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = (lead.nome_fantasia || lead.razao_social || '').toLowerCase();
        if (!name.includes(searchLower)) return false;
      }
      return true;
    });
  }, [leads, filters]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!leads || leads.length === 0) {
      return {
        totalLeads: 0,
        averageScore: 0,
        gradeA: 0,
        gradeB: 0,
        gradeC: 0,
        gradeD: 0,
        gradeF: 0,
        noScore: 0,
        averageFit: 0,
        averageIntent: 0,
      };
    }

    const withScore = leads.filter(l => l.lead_score !== null);
    const avgScore = withScore.length > 0 
      ? withScore.reduce((sum, l) => sum + (l.lead_score || 0), 0) / withScore.length 
      : 0;
    const avgFit = withScore.length > 0
      ? withScore.reduce((sum, l) => sum + (l.fit_score || 0), 0) / withScore.length
      : 0;
    const avgIntent = withScore.length > 0
      ? withScore.reduce((sum, l) => sum + (l.intent_score || 0), 0) / withScore.length
      : 0;

    return {
      totalLeads: leads.length,
      averageScore: Math.round(avgScore),
      gradeA: leads.filter(l => l.lead_grade === 'A').length,
      gradeB: leads.filter(l => l.lead_grade === 'B').length,
      gradeC: leads.filter(l => l.lead_grade === 'C').length,
      gradeD: leads.filter(l => l.lead_grade === 'D').length,
      gradeF: leads.filter(l => l.lead_grade === 'F').length,
      noScore: leads.filter(l => l.lead_grade === null).length,
      averageFit: Math.round(avgFit),
      averageIntent: Math.round(avgIntent),
    };
  }, [leads]);

  // Grade distribution for chart
  const gradeDistribution = useMemo(() => {
    return [
      { grade: 'A', label: 'Quentes', count: kpis.gradeA, color: '#22c55e' },
      { grade: 'B', label: 'Ativos', count: kpis.gradeB, color: '#3b82f6' },
      { grade: 'C', label: 'Mornos', count: kpis.gradeC, color: '#eab308' },
      { grade: 'D', label: 'Frios', count: kpis.gradeD, color: '#f97316' },
      { grade: 'F', label: 'Gelados', count: kpis.gradeF, color: '#ef4444' },
    ];
  }, [kpis]);

  // Segment stats
  const segmentStats = useMemo(() => {
    if (!leads) return [];
    
    const bySegment: Record<string, { count: number; totalScore: number }> = {};
    leads.forEach(lead => {
      const seg = lead.segmento || 'Não definido';
      if (!bySegment[seg]) {
        bySegment[seg] = { count: 0, totalScore: 0 };
      }
      bySegment[seg].count++;
      bySegment[seg].totalScore += lead.lead_score || 0;
    });

    return Object.entries(bySegment)
      .map(([segment, data]) => ({
        segment,
        count: data.count,
        averageScore: Math.round(data.totalScore / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [leads]);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    if (!leads) return { segments: [], sizes: [] };
    
    const segments = [...new Set(leads.map(l => l.segmento).filter(Boolean))];
    const sizes = [...new Set(leads.map(l => l.tamanho).filter(Boolean))];
    
    return { segments, sizes };
  }, [leads]);

  const clearFilters = () => setFilters({});

  return {
    leads: filteredLeads,
    allLeads: leads || [],
    kpis,
    gradeDistribution,
    segmentStats,
    filterOptions,
    filters,
    setFilters,
    clearFilters,
    isLoading,
    error,
  };
}
