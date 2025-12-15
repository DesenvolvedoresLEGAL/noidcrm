import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

interface CelebrationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  soundType: 'bell' | 'horn' | 'applause' | 'fanfare';
}

const DEFAULT_SETTINGS: CelebrationSettings = {
  enabled: true,
  soundEnabled: true,
  soundType: 'fanfare',
};

export function useCelebrationSettings() {
  const [settings, setSettings] = useState<CelebrationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const { organization } = useCurrentUser();

  useEffect(() => {
    async function loadSettings() {
      if (!organization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('organization_settings')
          .select('settings')
          .eq('organization_id', organization.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading celebration settings:', error);
        }

        if (data?.settings) {
          const orgSettings = data.settings as Record<string, any>;
          setSettings({
            enabled: orgSettings.celebration_enabled ?? DEFAULT_SETTINGS.enabled,
            soundEnabled: orgSettings.celebration_sound_enabled ?? DEFAULT_SETTINGS.soundEnabled,
            soundType: orgSettings.celebration_sound_type ?? DEFAULT_SETTINGS.soundType,
          });
        }
      } catch (error) {
        console.error('Error loading celebration settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [organization?.id]);

  const playCelebrationSound = () => {
    if (!settings.soundEnabled) return;
    
    const audio = new Audio(`/sounds/${settings.soundType}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(console.error);
  };

  return {
    ...settings,
    isLoading,
    playCelebrationSound,
  };
}
