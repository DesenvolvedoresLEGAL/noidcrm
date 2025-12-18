import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { CelebracoesSection } from './sections/CelebracoesSection';

export default function CelebracoesSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Celebrações"
      description="Configure como sua equipe celebra quando uma venda é fechada"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <CelebracoesSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
