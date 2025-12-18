import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { ForecastSection } from './sections/ForecastSection';

export default function ForecastSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Forecast"
      description="Configure as opções de previsão de vendas"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <ForecastSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
