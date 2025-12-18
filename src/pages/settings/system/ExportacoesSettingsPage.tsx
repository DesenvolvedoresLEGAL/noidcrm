import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { ExportacoesSection } from './sections/ExportacoesSection';

export default function ExportacoesSettingsPage() {
  const { settings, isLoading, isSaving, handleSettingChange } = useOrganizationSettings();

  return (
    <SettingsPageWrapper
      title="Exportações"
      description="Configure as permissões de exportação de dados"
      isLoading={isLoading}
      isSaving={isSaving}
    >
      <ExportacoesSection settings={settings} onSettingChange={handleSettingChange} />
    </SettingsPageWrapper>
  );
}
