import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { ReportsV2FlagsSection } from './sections/ReportsV2FlagsSection';

export default function ReportsV2FlagsSettingsPage() {
  return (
    <SettingsPageWrapper
      title="Reports V2 — Feature Flags"
      description="Controle granular de rollout dos relatórios canônicos V2. Apenas administradores podem editar."
    >
      <ReportsV2FlagsSection />
    </SettingsPageWrapper>
  );
}
