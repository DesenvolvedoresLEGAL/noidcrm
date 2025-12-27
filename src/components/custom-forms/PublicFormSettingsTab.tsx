import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, Link2, Palette, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PublicFormSettings, DEFAULT_PUBLIC_SETTINGS } from './PublicFormPreview';

interface PublicFormSettingsTabProps {
  isPublic: boolean;
  onIsPublicChange: (value: boolean) => void;
  publicToken: string | null;
  settings: PublicFormSettings;
  onSettingsChange: (settings: PublicFormSettings) => void;
}

export function PublicFormSettingsTab({
  isPublic,
  onIsPublicChange,
  publicToken,
  settings,
  onSettingsChange,
}: PublicFormSettingsTabProps) {
  const publicUrl = publicToken 
    ? `${window.location.origin}/f/${publicToken}` 
    : null;

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado!');
    }
  };

  const updateSetting = <K extends keyof PublicFormSettings>(
    key: K, 
    value: PublicFormSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Enable Public Toggle */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Tornar Público</Label>
          <p className="text-xs text-muted-foreground">
            Permitir que o formulário seja acessado via link público
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={onIsPublicChange}
        />
      </div>

      {/* Public Link */}
      {isPublic && publicToken && (
        <div className="p-3 border rounded-lg bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Link Público</Label>
          </div>
          <div className="flex gap-2">
            <Input
              value={publicUrl || ''}
              readOnly
              className="text-xs bg-background"
            />
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(publicUrl!, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isPublic && (
        <>
          <Separator />
          
          {/* Page Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4" />
              Personalização
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título da Página</Label>
                <Input
                  value={settings.page_title}
                  onChange={(e) => updateSetting('page_title', e.target.value)}
                  placeholder="Ficha Cadastral"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL do Logo</Label>
                <Input
                  value={settings.logo_url}
                  onChange={(e) => updateSetting('logo_url', e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor da Página</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.page_bg_color}
                    onChange={(e) => updateSetting('page_bg_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input
                    value={settings.page_bg_color}
                    onChange={(e) => updateSetting('page_bg_color', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto da Página</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.page_text_color}
                    onChange={(e) => updateSetting('page_text_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input
                    value={settings.page_text_color}
                    onChange={(e) => updateSetting('page_text_color', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor do Formulário</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.form_bg_color}
                    onChange={(e) => updateSetting('form_bg_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input
                    value={settings.form_bg_color}
                    onChange={(e) => updateSetting('form_bg_color', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto do Formulário</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.form_text_color}
                    onChange={(e) => updateSetting('form_text_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input
                    value={settings.form_text_color}
                    onChange={(e) => updateSetting('form_text_color', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor do Botão</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.button_color}
                    onChange={(e) => updateSetting('button_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input
                    value={settings.button_color}
                    onChange={(e) => updateSetting('button_color', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto do Botão</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.button_text_color}
                    onChange={(e) => updateSetting('button_text_color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input
                    value={settings.button_text_color}
                    onChange={(e) => updateSetting('button_text_color', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Texto do Botão de Envio</Label>
              <Input
                value={settings.button_text}
                onChange={(e) => updateSetting('button_text', e.target.value)}
                placeholder="Enviar"
                className="h-8 text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Bordas Arredondadas</Label>
              <Switch
                checked={settings.use_rounded_borders}
                onCheckedChange={(v) => updateSetting('use_rounded_borders', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Exibir Ícones dos Campos</Label>
              <Switch
                checked={settings.show_field_icons}
                onCheckedChange={(v) => updateSetting('show_field_icons', v)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
