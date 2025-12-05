import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export type DashboardRoleType = 'rep' | 'manager' | 'admin' | 'owner';

export interface DashboardPreferences {
  id: string;
  user_id: string;
  organization_id: string;
  role_type: DashboardRoleType;
  layout_config: Record<string, any>;
  widgets_order: string[];
  hidden_widgets: string[];
  refresh_interval: number;
  theme_preference: string;
  created_at: string;
  updated_at: string;
}

export function useDashboardPreferences(roleType: DashboardRoleType) {
  const { user, organization } = useCurrentUser();
  const organizationId = organization?.id;
  const queryClient = useQueryClient();

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ['dashboard-preferences', user?.id, roleType],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('role_type', roleType)
        .maybeSingle();

      if (error) throw error;
      return data as DashboardPreferences | null;
    },
    enabled: !!user?.id,
  });

  const savePreferences = useMutation({
    mutationFn: async (updates: Partial<Omit<DashboardPreferences, 'id' | 'user_id' | 'organization_id' | 'role_type' | 'created_at' | 'updated_at'>>) => {
      if (!user?.id || !organizationId) throw new Error('User not authenticated');

      const existingPrefs = preferences;

      if (existingPrefs) {
        const { data, error } = await supabase
          .from('dashboard_preferences')
          .update(updates)
          .eq('id', existingPrefs.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('dashboard_preferences')
          .insert({
            user_id: user.id,
            organization_id: organizationId,
            role_type: roleType,
            ...updates,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-preferences', user?.id, roleType] });
    },
  });

  const updateWidgetsOrder = (order: string[]) => {
    savePreferences.mutate({ widgets_order: order });
  };

  const toggleWidgetVisibility = (widgetId: string) => {
    const currentHidden = preferences?.hidden_widgets || [];
    const newHidden = currentHidden.includes(widgetId)
      ? currentHidden.filter(w => w !== widgetId)
      : [...currentHidden, widgetId];
    savePreferences.mutate({ hidden_widgets: newHidden });
  };

  const updateLayoutConfig = (config: Record<string, any>) => {
    savePreferences.mutate({ 
      layout_config: { ...(preferences?.layout_config || {}), ...config } 
    });
  };

  const updateRefreshInterval = (interval: number) => {
    savePreferences.mutate({ refresh_interval: interval });
  };

  return {
    preferences,
    isLoading,
    error,
    savePreferences: savePreferences.mutate,
    isSaving: savePreferences.isPending,
    updateWidgetsOrder,
    toggleWidgetVisibility,
    updateLayoutConfig,
    updateRefreshInterval,
  };
}
