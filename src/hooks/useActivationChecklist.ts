import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  action?: string;
  route?: string;
}

export interface ActivationChecklistData {
  id: string;
  organizationId: string;
  items: Record<string, boolean>;
  progress: number;
  dismissedAt: string | null;
  completedAt: string | null;
}

const CHECKLIST_ITEMS: Omit<ChecklistItem, 'completed'>[] = [
  { key: 'setup_company', label: 'Configurar empresa', description: 'Configure os dados da sua empresa', route: '/app/settings/organization' },
  { key: 'invite_member', label: 'Convidar vendedor', description: 'Adicione membros à sua equipe', route: '/app/settings/people' },
  { key: 'set_goal', label: 'Definir metas/OTE', description: 'Estabeleça metas e OTE para sua equipe', route: '/app/settings/goals' },
  { key: 'choose_pipeline', label: 'Configurar pipeline', description: 'Configure seu pipeline de vendas', route: '/app/pipeline' },
  { key: 'customize_stages', label: 'Configurar etapas', description: 'Ajuste as etapas do seu pipeline', route: '/app/settings/pipelines' },
  { key: 'add_product', label: 'Cadastrar produtos', description: 'Adicione seus produtos ou serviços', route: '/app/products' },
  { key: 'create_opportunity', label: 'Criar oportunidade', description: 'Comece a rastrear seus negócios', route: '/app/pipeline' },
  { key: 'create_proposal', label: 'Criar proposta', description: 'Crie sua primeira proposta comercial', route: '/app/proposals' },
  { key: 'visit_forecast', label: 'Acessar Forecast', description: 'Veja previsões de vendas da sua operação', route: '/app/forecast' },
  { key: 'create_automation', label: 'Criar automação', description: 'Configure sua primeira automação de follow-up', route: '/app/automation' },
];

export function useActivationChecklist() {
  const { organization } = useCurrentUser();
  const organizationId = organization?.id;
  const [data, setData] = useState<ActivationChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const fetchChecklist = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      const { data: checklist, error } = await supabase
        .from('activation_checklist')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;

      if (checklist) {
        setData({
          id: checklist.id,
          organizationId: checklist.organization_id,
          items: (checklist.items as Record<string, boolean>) || {},
          progress: checklist.progress || 0,
          dismissedAt: checklist.dismissed_at,
          completedAt: checklist.completed_at,
        });
      } else {
        // Create checklist if it doesn't exist
        const { data: newChecklist, error: createError } = await supabase
          .from('activation_checklist')
          .insert({ organization_id: organizationId })
          .select()
          .single();

        if (createError) throw createError;

        setData({
          id: newChecklist.id,
          organizationId: newChecklist.organization_id,
          items: (newChecklist.items as Record<string, boolean>) || {},
          progress: newChecklist.progress || 0,
          dismissedAt: newChecklist.dismissed_at,
          completedAt: newChecklist.completed_at,
        });
      }
    } catch (error) {
      console.error('[useActivationChecklist] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // Auto-detect completed items
  const detectCompletedItems = useCallback(async () => {
    if (!organizationId || !data) return;

    try {
      // Check for opportunities
      const { count: oppCount } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Check for members
      const { count: memberCount } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      // Check for products
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Check for proposals
      const { count: proposalCount } = await supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Check for goals
      const { count: goalCount } = await supabase
        .from('sales_goals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Check for automations
      const { count: automationCount } = await supabase
        .from('auto_tasks_rules')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      const updatedItems = {
        ...data.items,
        create_opportunity: (oppCount || 0) > 0,
        invite_member: (memberCount || 0) > 1,
        add_product: (productCount || 0) > 0,
        create_proposal: (proposalCount || 0) > 0,
        set_goal: (goalCount || 0) > 0,
        create_automation: (automationCount || 0) > 0,
      };

      // Calculate new progress
      const completedCount = Object.values(updatedItems).filter(Boolean).length;
      const newProgress = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);

      // Update if changed
      if (JSON.stringify(updatedItems) !== JSON.stringify(data.items)) {
        await supabase
          .from('activation_checklist')
          .update({
            items: updatedItems,
            progress: newProgress,
            completed_at: newProgress === 100 ? new Date().toISOString() : null,
          })
          .eq('id', data.id);

        setData({
          ...data,
          items: updatedItems,
          progress: newProgress,
          completedAt: newProgress === 100 ? new Date().toISOString() : null,
        });
      }
    } catch (error) {
      console.error('[useActivationChecklist] Detection error:', error);
    }
  }, [organizationId, data]);

  useEffect(() => {
    if (data && !data.completedAt) {
      detectCompletedItems();
    }
  }, [data?.id]);

  const markItemComplete = useCallback(async (itemKey: string) => {
    if (!data) return;

    const updatedItems = { ...data.items, [itemKey]: true };
    const completedCount = Object.values(updatedItems).filter(Boolean).length;
    const newProgress = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);

    await supabase
      .from('activation_checklist')
      .update({
        items: updatedItems,
        progress: newProgress,
        completed_at: newProgress === 100 ? new Date().toISOString() : null,
      })
      .eq('id', data.id);

    setData({
      ...data,
      items: updatedItems,
      progress: newProgress,
      completedAt: newProgress === 100 ? new Date().toISOString() : null,
    });
  }, [data]);

  const dismissChecklist = useCallback(async () => {
    if (!data) return;

    await supabase
      .from('activation_checklist')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', data.id);

    setData({ ...data, dismissedAt: new Date().toISOString() });
  }, [data]);

  const items: ChecklistItem[] = CHECKLIST_ITEMS.map((item) => ({
    ...item,
    completed: data?.items[item.key] || false,
  }));

  const nextItem = items.find((item) => !item.completed);
  const isVisible = data && !data.dismissedAt && !data.completedAt;

  return {
    items,
    progress: data?.progress || 0,
    loading,
    isVisible,
    isMinimized,
    nextItem,
    setIsMinimized,
    markItemComplete,
    dismissChecklist,
    refetch: fetchChecklist,
  };
}
