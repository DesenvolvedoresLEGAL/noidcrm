import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PartyPopper, Volume2, Play } from 'lucide-react';

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

export function CelebracoesSection({ settings, onSettingChange }: CelebracoesSectionProps) {
  const celebrationEnabled = settings.celebration_enabled ?? true;
  const soundEnabled = settings.celebration_sound_enabled ?? true;
  const soundType = settings.celebration_sound_type ?? 'fanfare';

  const playSound = (type: string) => {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(console.error);
  };

  const previewCelebration = () => {
    // Trigger confetti preview
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });
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
        <CardContent className="space-y-4">
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
            <div className="space-y-3">
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
