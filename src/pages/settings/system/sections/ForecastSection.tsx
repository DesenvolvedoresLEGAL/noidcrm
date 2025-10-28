import React from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { SettingSwitch } from '@/components/settings/SettingSwitch';

interface ForecastSectionProps {
  settings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

export function ForecastSection({ settings, onSettingChange }: ForecastSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Forecast</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure as opções de previsão de vendas
        </p>
      </div>

      <SettingCard title="Configurações de Forecast">
        <div className="divide-y">
          <SettingSwitch
            label="Exibir itens da proposta"
            description="Mostrar os itens detalhados da proposta no forecast"
            checked={settings.forecast_exibir_itens ?? true}
            onCheckedChange={(checked) => onSettingChange('forecast_exibir_itens', checked)}
          />
          <SettingSwitch
            label="Exibir campos customizados"
            description="Permitir visualização de campos personalizados no relatório de forecast"
            checked={settings.forecast_exibir_campos_customizados ?? false}
            onCheckedChange={(checked) => onSettingChange('forecast_exibir_campos_customizados', checked)}
          />
        </div>
      </SettingCard>
    </div>
  );
}
