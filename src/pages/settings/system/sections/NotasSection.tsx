import React from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { SettingSwitch } from '@/components/settings/SettingSwitch';

interface NotasSectionProps {
  settings: Record<string, boolean>;
  onSettingChange: (key: string, value: boolean) => void;
}

export function NotasSection({ settings, onSettingChange }: NotasSectionProps) {
  return (
    <div className="space-y-6">
      <SettingCard title="Oportunidades">
        <div className="divide-y">
          <SettingSwitch
            label="Permitir mencionar outros usuários"
            description="Usuários podem mencionar outros usuários em notas de oportunidades"
            checked={settings.notas_oportunidades_mencionar ?? true}
            onCheckedChange={(checked) => onSettingChange('notas_oportunidades_mencionar', checked)}
          />
          <SettingSwitch
            label="Notificação por e-mail de menção"
            description="Enviar e-mail quando um usuário for mencionado em uma nota"
            checked={settings.notas_oportunidades_notificar_email ?? true}
            onCheckedChange={(checked) => onSettingChange('notas_oportunidades_notificar_email', checked)}
          />
        </div>
      </SettingCard>

      <SettingCard title="Empresas">
        <div className="divide-y">
          <SettingSwitch
            label="Permitir mencionar outros usuários"
            description="Usuários podem mencionar outros usuários em notas de empresas"
            checked={settings.notas_empresas_mencionar ?? true}
            onCheckedChange={(checked) => onSettingChange('notas_empresas_mencionar', checked)}
          />
          <SettingSwitch
            label="Notificação por e-mail de menção"
            description="Enviar e-mail quando um usuário for mencionado em uma nota"
            checked={settings.notas_empresas_notificar_email ?? true}
            onCheckedChange={(checked) => onSettingChange('notas_empresas_notificar_email', checked)}
          />
        </div>
      </SettingCard>

      <SettingCard title="Pessoas">
        <div className="divide-y">
          <SettingSwitch
            label="Permitir mencionar outros usuários"
            description="Usuários podem mencionar outros usuários em notas de pessoas"
            checked={settings.notas_pessoas_mencionar ?? true}
            onCheckedChange={(checked) => onSettingChange('notas_pessoas_mencionar', checked)}
          />
          <SettingSwitch
            label="Notificação por e-mail de menção"
            description="Enviar e-mail quando um usuário for mencionado em uma nota"
            checked={settings.notas_pessoas_notificar_email ?? true}
            onCheckedChange={(checked) => onSettingChange('notas_pessoas_notificar_email', checked)}
          />
        </div>
      </SettingCard>
    </div>
  );
}
