import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { RelatoriosSection } from './sections/RelatoriosSection';

export default function RelatoriosSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Relatórios"
      description="Configure as opções de relatórios"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <RelatoriosSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
