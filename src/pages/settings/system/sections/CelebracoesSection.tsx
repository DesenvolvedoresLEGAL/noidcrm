import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PartyPopper, Volume2, Play, Sparkles, Clock } from 'lucide-react';

interface CelebracoesSectionProps {
  settings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

const SOUND_OPTIONS = [
  { value: 'bell', label: 'Sino', emoji: '🔔' },
  { value: 'horn', label: 'Buzina', emoji: '📯' },
  { value: 'applause', label: 'Aplausos', emoji: '👏' },
  { value: 'fanfare', label: 'Fanfarra', emoji: '🎺' },
];

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Sutil', particles: 25 },
  { value: 'medium', label: 'Moderado', particles: 50 },
  { value: 'high', label: 'Intenso', particles: 100 },
  { value: 'extreme', label: 'Explosivo', particles: 150 },
];

const DURATION_OPTIONS = [
  { value: 2000, label: '2 segundos' },
  { value: 3000, label: '3 segundos' },
  { value: 5000, label: '5 segundos' },
  { value: 8000, label: '8 segundos' },
];

export function CelebracoesSection({ settings, onSettingChange }: CelebracoesSectionProps) {
  const celebrationEnabled = settings.celebration_enabled ?? true;
  const soundEnabled = settings.celebration_sound_enabled ?? true;
  const soundType = settings.celebration_sound_type ?? 'fanfare';
  const confettiIntensity = settings.celebration_confetti_intensity ?? 'medium';
  const animationDuration = settings.celebration_animation_duration ?? 3000;
  const soundVolume = settings.celebration_sound_volume ?? 50;

  const playSound = (type: string, volume?: number) => {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.volume = (volume ?? soundVolume) / 100;
    audio.play().catch(console.error);
  };

  const previewCelebration = () => {
    const intensity = INTENSITY_OPTIONS.find(i => i.value === confettiIntensity);
    const particles = intensity?.particles ?? 50;

    // Trigger confetti preview
    import('canvas-confetti').then(({ default: confetti }) => {
      const duration = animationDuration;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = particles * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
        });
      }, 250);

      setTimeout(() => clearInterval(interval), duration + 100);
    });

    // Play sound if enabled
    if (soundEnabled) {
      playSound(soundType);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Celebrações</h2>
        <p className="text-muted-foreground">
          Configure como sua equipe celebra quando uma venda é fechada
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            Celebração Visual
          </CardTitle>
          <CardDescription>
            Exibe animação de confetes quando uma proposta é aprovada em pipelines de vendas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="celebration-enabled" className="flex flex-col gap-1">
              <span>Ativar celebração visual</span>
              <span className="text-xs text-muted-foreground font-normal">
                Mostra confetes e animações quando um deal é fechado
              </span>
            </Label>
            <Switch
              id="celebration-enabled"
              checked={celebrationEnabled}
              onCheckedChange={(checked) => onSettingChange('celebration_enabled', checked)}
            />
          </div>

          {celebrationEnabled && (
            <>
              <div className="space-y-3 pt-2 border-t">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  Intensidade do confete
                </Label>
                <Select
                  value={confettiIntensity}
                  onValueChange={(value) => onSettingChange('celebration_confetti_intensity', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Duração da animação
                </Label>
                <Select
                  value={animationDuration.toString()}
                  onValueChange={(value) => onSettingChange('celebration_animation_duration', parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Som de Celebração
          </CardTitle>
          <CardDescription>
            Toca um som de comemoração junto com a animação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="sound-enabled" className="flex flex-col gap-1">
              <span>Ativar som de celebração</span>
              <span className="text-xs text-muted-foreground font-normal">
                Reproduz áudio quando um deal é fechado
              </span>
            </Label>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              onCheckedChange={(checked) => onSettingChange('celebration_sound_enabled', checked)}
            />
          </div>

          {soundEnabled && (
            <>
              <div className="space-y-3 pt-2 border-t">
                <Label>Tipo de som</Label>
                <Select
                  value={soundType}
                  onValueChange={(value) => onSettingChange('celebration_sound_type', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span>{option.emoji}</span>
                          <span>{option.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex flex-wrap gap-2 pt-2">
                  {SOUND_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      size="sm"
                      onClick={() => playSound(option.value)}
                      className="gap-2"
                    >
                      <Play className="h-3 w-3" />
                      {option.emoji} {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Volume do som</Label>
                  <span className="text-sm text-muted-foreground">{soundVolume}%</span>
                </div>
                <Slider
                  value={[soundVolume]}
                  onValueChange={([value]) => onSettingChange('celebration_sound_volume', value)}
                  min={10}
                  max={100}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Baixo</span>
                  <span>Alto</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Clique para visualizar como ficará a celebração com as configurações atuais
            </p>
            <Button onClick={previewCelebration} className="gap-2">
              <PartyPopper className="h-4 w-4" />
              Testar Celebração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
