import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { OportunidadesCartoesSection } from './sections/OportunidadesCartoesSection';

export default function OportunidadesCartoesSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Cards do Pipeline"
      description="Personalize a exibição dos cards de oportunidades no Kanban"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <OportunidadesCartoesSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
