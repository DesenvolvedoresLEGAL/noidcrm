import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { NotasSection } from './sections/NotasSection';

export default function NotasSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Notas"
      description="Configure as opções de notas e menções"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <NotasSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
