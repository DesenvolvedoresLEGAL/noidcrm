import React from 'react';
import { SettingsPageWrapper } from '@/components/settings/SettingsPageWrapper';
import { ReportsHealthAdminPanel } from './sections/ReportsHealthAdminPanel';

export default function ReportsHealthAdminPage() {
  return (
    <SettingsPageWrapper
      title="Reports V2 — Saúde da plataforma"
      description="Confiança, cobertura, reconciliação cross-relatórios e prontidão de cada aba para desligar o legacy."
    >
      <ReportsHealthAdminPanel />
    </SettingsPageWrapper>
  );
}
