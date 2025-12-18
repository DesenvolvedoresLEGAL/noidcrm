import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { PropostasSiglasSection } from './sections/PropostasSiglasSection';

export default function PropostasSiglasSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Siglas Sequenciais"
      description="Configure a numeração automática de propostas"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <PropostasSiglasSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
