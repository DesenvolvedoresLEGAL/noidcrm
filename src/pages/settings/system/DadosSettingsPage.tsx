import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { DadosSection } from './sections/DadosSection';

export default function DadosSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Configurações Gerais"
      description="Configurações gerais da organização, notificações e preferências do sistema"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <DadosSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
