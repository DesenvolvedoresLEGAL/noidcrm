import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

export function useOrganizationSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const debouncedSettings = useDebounce(settings, 1000);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!organization?.id) return;

      try {
        const { data, error } = await supabase
          .from('organization_settings')
          .select('settings')
          .eq('organization_id', organization.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data?.settings) {
          setSettings(data.settings as Record<string, any>);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Erro ao carregar configurações',
          description: 'Não foi possível carregar as configurações do sistema.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [organization?.id]);

  // Auto-save settings
  useEffect(() => {
    async function saveSettings() {
      if (!organization?.id || isLoading) return;

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('organization_settings')
          .upsert({
            organization_id: organization.id,
            settings: debouncedSettings,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;

        toast({
          title: 'Configurações salvas',
          description: 'As alterações foram salvas automaticamente.',
        });
      } catch (error) {
        console.error('Error saving settings:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar as configurações.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }

    if (Object.keys(debouncedSettings).length > 0) {
      saveSettings();
    }
  }, [debouncedSettings, organization?.id, isLoading]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return {
    settings,
    isLoading,
    isSaving,
    handleSettingChange,
  };
}
