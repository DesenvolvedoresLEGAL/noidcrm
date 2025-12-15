import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

interface CelebrationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  soundType: 'bell' | 'horn' | 'applause' | 'fanfare';
  confettiIntensity: 'low' | 'medium' | 'high' | 'extreme';
  animationDuration: number;
  soundVolume: number;
  soundDuration: number;
}

const DEFAULT_SETTINGS: CelebrationSettings = {
  enabled: true,
  soundEnabled: true,
  soundType: 'fanfare',
  confettiIntensity: 'medium',
  animationDuration: 3000,
  soundVolume: 50,
  soundDuration: 0,
};

const INTENSITY_PARTICLES: Record<string, number> = {
  low: 25,
  medium: 50,
  high: 100,
  extreme: 150,
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
            confettiIntensity: orgSettings.celebration_confetti_intensity ?? DEFAULT_SETTINGS.confettiIntensity,
            animationDuration: orgSettings.celebration_animation_duration ?? DEFAULT_SETTINGS.animationDuration,
            soundVolume: orgSettings.celebration_sound_volume ?? DEFAULT_SETTINGS.soundVolume,
            soundDuration: orgSettings.celebration_sound_duration ?? DEFAULT_SETTINGS.soundDuration,
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
    
    const audio = new Audio(`/sounds/${settings.soundType}.mp3?v=3`);
    audio.volume = settings.soundVolume / 100;
    
    // Se duração for 0 (completo), toca uma vez até o fim
    if (settings.soundDuration === 0) {
      audio.play().catch(console.error);
      return;
    }
    
    // Configurar loop para repetir o som
    audio.loop = true;
    audio.play().catch(console.error);
    
    // Parar após a duração configurada
    setTimeout(() => {
      audio.loop = false;
      audio.pause();
      audio.currentTime = 0;
    }, settings.soundDuration * 1000);
  };

  const getParticleCount = () => {
    return INTENSITY_PARTICLES[settings.confettiIntensity] ?? 50;
  };

  return {
    ...settings,
    isLoading,
    playCelebrationSound,
    getParticleCount,
  };
}
