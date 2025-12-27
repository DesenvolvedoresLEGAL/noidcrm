import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Palette } from 'lucide-react';
import { PublicFormSettings } from './PublicFormPreview';

interface PublicFormSettingsTabProps {
  settings: PublicFormSettings;
  onSettingsChange: (settings: PublicFormSettings) => void;
}

export function PublicFormSettingsTab({
  settings,
  onSettingsChange,
}: PublicFormSettingsTabProps) {
  const updateSetting = <K extends keyof PublicFormSettings>(
    key: K, 
    value: PublicFormSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          O logotipo será automaticamente puxado das configurações da organização.
          A habilitação do link público é feita na aba de formulários dentro de cada oportunidade.
        </p>
      </div>
      
      <Separator />
      
      {/* Page Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Palette className="h-4 w-4" />
          Personalização
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Título da Página</Label>
          <Input
            value={settings.page_title}
            onChange={(e) => updateSetting('page_title', e.target.value)}
            placeholder="Ficha Cadastral"
            className="h-8 text-sm"
          />
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
    </div>
  );
}