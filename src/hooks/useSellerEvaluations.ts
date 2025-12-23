import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface FitScoreFactor {
  key: string;
  label: string;
  weight: number;
  description?: string;
}

export interface FitScoreConfig {
  id: string;
  organization_id: string;
  cultural_weight: number;
  performance_weight: number;
  cultural_factors: FitScoreFactor[];
  performance_factors: FitScoreFactor[];
}

export interface SellerEvaluation {
  id: string;
  seller_id: string;
  organization_id: string;
  evaluator_id: string | null;
  period_start: string;
  period_end: string;
  cultural_fit_score: number;
  performance_score: number;
  fit_score: number;
  cultural_factors_scores: Record<string, number>;
  performance_factors_scores: Record<string, number>;
  notes: string | null;
  strengths: string | null;
  improvements: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  seller?: {
    id: string;
    name: string;
    current_fit_score: number | null;
  };
  evaluator?: {
    id: string;
    full_name: string;
  };
}

export interface CreateEvaluationData {
  seller_id: string;
  period_start: string;
  period_end: string;
  cultural_fit_score: number;
  performance_score: number;
  cultural_factors_scores: Record<string, number>;
  performance_factors_scores: Record<string, number>;
  notes?: string;
  strengths?: string;
  improvements?: string;
  status?: 'draft' | 'submitted';
}

export function useSellerEvaluations() {
  const { organization } = useCurrentOrganization();
  const [evaluations, setEvaluations] = useState<SellerEvaluation[]>([]);
  const [config, setConfig] = useState<FitScoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (!organization?.id) return;
    
    setConfigLoading(true);
    try {
      const { data, error } = await supabase
        .from('fit_score_config')
        .select('*')
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          ...data,
          cultural_factors: (Array.isArray(data.cultural_factors) ? data.cultural_factors : []) as unknown as FitScoreFactor[],
          performance_factors: (Array.isArray(data.performance_factors) ? data.performance_factors : []) as unknown as FitScoreFactor[],
        });
      } else {
        // Create default config
        const defaultCulturalFactors = [
          { key: 'valores', label: 'Alinhamento com Valores', weight: 0.30, description: 'Quanto o vendedor demonstra os valores da empresa' },
          { key: 'comunicacao', label: 'Comunicação', weight: 0.25, description: 'Clareza e efetividade na comunicação' },
          { key: 'colaboracao', label: 'Colaboração em Equipe', weight: 0.25, description: 'Trabalho em equipe e cooperação' },
          { key: 'proatividade', label: 'Proatividade', weight: 0.20, description: 'Iniciativa e antecipação de necessidades' },
        ];
        
        const defaultPerformanceFactors = [
          { key: 'metas', label: 'Atingimento de Metas', weight: 0.40, description: 'Histórico de cumprimento de metas' },
          { key: 'qualidade', label: 'Qualidade do Trabalho', weight: 0.30, description: 'Qualidade das entregas e atendimento' },
          { key: 'evolucao', label: 'Evolução Contínua', weight: 0.30, description: 'Crescimento e aprendizado' },
        ];

        const { data: newConfig, error: insertError } = await supabase
          .from('fit_score_config')
          .insert({
            organization_id: organization.id,
            cultural_weight: 0.50,
            performance_weight: 0.50,
            cultural_factors: defaultCulturalFactors as unknown as Json,
            performance_factors: defaultPerformanceFactors as unknown as Json,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        
        setConfig({
          ...newConfig,
          cultural_factors: defaultCulturalFactors,
          performance_factors: defaultPerformanceFactors,
        });
      }
    } catch (error) {
      console.error('Error fetching fit score config:', error);
      toast.error('Erro ao carregar configuração de FitScore');
    } finally {
      setConfigLoading(false);
    }
  }, [organization?.id]);

  const fetchEvaluations = useCallback(async () => {
    if (!organization?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_evaluations')
        .select(`
          *,
          seller:sellers!seller_evaluations_seller_id_fkey(id, name, current_fit_score),
          evaluator:profiles!seller_evaluations_evaluator_id_fkey(id, full_name)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the data to our interface
      const mappedData = (data || []).map(item => ({
        ...item,
        cultural_factors_scores: (item.cultural_factors_scores || {}) as Record<string, number>,
        performance_factors_scores: (item.performance_factors_scores || {}) as Record<string, number>,
        seller: item.seller,
        evaluator: item.evaluator,
      })) as unknown as SellerEvaluation[];
      
      setEvaluations(mappedData);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      toast.error('Erro ao carregar avaliações');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchConfig();
    fetchEvaluations();
  }, [fetchConfig, fetchEvaluations]);

  const createEvaluation = async (data: CreateEvaluationData) => {
    if (!organization?.id) throw new Error('Organization not found');

    const { data: currentUser } = await supabase.auth.getUser();
    
    const { data: evaluation, error } = await supabase
      .from('seller_evaluations')
      .insert({
        seller_id: data.seller_id,
        organization_id: organization.id,
        evaluator_id: currentUser.user?.id,
        period_start: data.period_start,
        period_end: data.period_end,
        cultural_fit_score: data.cultural_fit_score,
        performance_score: data.performance_score,
        cultural_factors_scores: data.cultural_factors_scores as unknown as Json,
        performance_factors_scores: data.performance_factors_scores as unknown as Json,
        notes: data.notes || null,
        strengths: data.strengths || null,
        improvements: data.improvements || null,
        status: data.status || 'draft',
        submitted_at: data.status === 'submitted' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;
    
    await fetchEvaluations();
    toast.success('Avaliação criada com sucesso');
    return evaluation;
  };

  const updateEvaluation = async (id: string, data: Partial<CreateEvaluationData>) => {
    const updateData: Record<string, unknown> = {};
    
    if (data.cultural_fit_score !== undefined) updateData.cultural_fit_score = data.cultural_fit_score;
    if (data.performance_score !== undefined) updateData.performance_score = data.performance_score;
    if (data.cultural_factors_scores) updateData.cultural_factors_scores = data.cultural_factors_scores as unknown as Json;
    if (data.performance_factors_scores) updateData.performance_factors_scores = data.performance_factors_scores as unknown as Json;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.strengths !== undefined) updateData.strengths = data.strengths;
    if (data.improvements !== undefined) updateData.improvements = data.improvements;
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'submitted') {
        updateData.submitted_at = new Date().toISOString();
      }
    }
    
    const { error } = await supabase
      .from('seller_evaluations')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    
    await fetchEvaluations();
    toast.success('Avaliação atualizada');
  };

  const approveEvaluation = async (id: string) => {
    const { data: currentUser } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('seller_evaluations')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: currentUser.user?.id,
      })
      .eq('id', id);

    if (error) throw error;
    
    await fetchEvaluations();
    toast.success('Avaliação aprovada! FitScore do vendedor atualizado.');
  };

  const rejectEvaluation = async (id: string) => {
    const { error } = await supabase
      .from('seller_evaluations')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (error) throw error;
    
    await fetchEvaluations();
    toast.success('Avaliação rejeitada');
  };

  const deleteEvaluation = async (id: string) => {
    const { error } = await supabase
      .from('seller_evaluations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    await fetchEvaluations();
    toast.success('Avaliação excluída');
  };

  const updateConfig = async (newConfig: Partial<FitScoreConfig>) => {
    if (!config?.id) throw new Error('Config not found');

    const { error } = await supabase
      .from('fit_score_config')
      .update({
        cultural_weight: newConfig.cultural_weight,
        performance_weight: newConfig.performance_weight,
        cultural_factors: newConfig.cultural_factors as unknown as Json,
        performance_factors: newConfig.performance_factors as unknown as Json,
      })
      .eq('id', config.id);

    if (error) throw error;
    
    await fetchConfig();
    toast.success('Configuração atualizada');
  };

  return {
    evaluations,
    config,
    loading,
    configLoading,
    fetchEvaluations,
    fetchConfig,
    createEvaluation,
    updateEvaluation,
    approveEvaluation,
    rejectEvaluation,
    deleteEvaluation,
    updateConfig,
  };
}
