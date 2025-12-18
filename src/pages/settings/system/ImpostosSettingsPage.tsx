import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { ImpostosSection } from './sections/ImpostosSection';

export default function ImpostosSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Impostos"
      description="Configure os impostos para produtos e serviços"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <ImpostosSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
