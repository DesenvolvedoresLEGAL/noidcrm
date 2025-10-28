import React from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { SettingSwitch } from '@/components/settings/SettingSwitch';

interface RelatoriosSectionProps {
  settings: Record<string, boolean>;
  onSettingChange: (key: string, value: boolean) => void;
}

export function RelatoriosSection({ settings, onSettingChange }: RelatoriosSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Relatórios</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure quais relatórios estarão disponíveis no sistema
        </p>
      </div>

      <SettingCard title="Relatório Geral">
        <div className="divide-y">
          <SettingSwitch
            label="Considerar oportunidades completas em 'Novas oportunidades'"
            description="Incluir oportunidades totalmente preenchidas no cálculo de novas oportunidades"
            checked={settings.relatorio_considerar_completas ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_considerar_completas', checked)}
          />
          <SettingSwitch
            label="Habilitar relatório geral"
            description="Disponibilizar o relatório geral para os usuários"
            checked={settings.relatorio_geral_habilitado ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_geral_habilitado', checked)}
          />
        </div>
      </SettingCard>

      <SettingCard title="Outros Relatórios">
        <div className="divide-y">
          <SettingSwitch
            label="Relacionamento de funil"
            checked={settings.relatorio_relacionamento_funil ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_relacionamento_funil', checked)}
          />
          <SettingSwitch
            label="Taxa de conversão"
            checked={settings.relatorio_taxa_conversao ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_taxa_conversao', checked)}
          />
          <SettingSwitch
            label="Forecast"
            checked={settings.relatorio_forecast ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_forecast', checked)}
          />
          <SettingSwitch
            label="Itens contidos"
            checked={settings.relatorio_itens_contidos ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_itens_contidos', checked)}
          />
          <SettingSwitch
            label="Performance de e-mails"
            checked={settings.relatorio_performance_emails ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_performance_emails', checked)}
          />
        </div>
      </SettingCard>

      <SettingCard title="Oportunidades Processadas">
        <div className="divide-y">
          <SettingSwitch
            label="Por estrutura"
            checked={settings.relatorio_processadas_estrutura ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_estrutura', checked)}
          />
          <SettingSwitch
            label="Por rede"
            checked={settings.relatorio_processadas_rede ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_rede', checked)}
          />
          <SettingSwitch
            label="Por usuário"
            checked={settings.relatorio_processadas_usuario ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_usuario', checked)}
          />
          <SettingSwitch
            label="Por origem"
            checked={settings.relatorio_processadas_origem ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_origem', checked)}
          />
          <SettingSwitch
            label="Por grupo de origem"
            checked={settings.relatorio_processadas_grupo_origem ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_grupo_origem', checked)}
          />
          <SettingSwitch
            label="Por segmento"
            checked={settings.relatorio_processadas_segmento ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_segmento', checked)}
          />
          <SettingSwitch
            label="Por região"
            checked={settings.relatorio_processadas_regiao ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_regiao', checked)}
          />
          <SettingSwitch
            label="Por estado"
            checked={settings.relatorio_processadas_estado ?? true}
            onCheckedChange={(checked) => onSettingChange('relatorio_processadas_estado', checked)}
          />
        </div>
      </SettingCard>
    </div>
  );
}
