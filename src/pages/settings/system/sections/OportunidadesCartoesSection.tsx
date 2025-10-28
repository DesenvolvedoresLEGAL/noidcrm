import React from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { SettingSwitch } from '@/components/settings/SettingSwitch';
import { SettingSelect } from '@/components/settings/SettingSelect';

interface OportunidadesCartoesSectionProps {
  settings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

export function OportunidadesCartoesSection({ settings, onSettingChange }: OportunidadesCartoesSectionProps) {
  const displayOptions = [
    { key: 'cartoes_exibir_pessoa', label: 'Exibir pessoa' },
    { key: 'cartoes_exibir_empresa', label: 'Exibir empresa' },
    { key: 'cartoes_exibir_valor_ps', label: 'Exibir valor P&S' },
    { key: 'cartoes_exibir_valor_mrr', label: 'Exibir valor MRR' },
    { key: 'cartoes_exibir_origem', label: 'Exibir origem' },
    { key: 'cartoes_exibir_fonte', label: 'Exibir fonte' },
    { key: 'cartoes_exibir_temperatura', label: 'Exibir temperatura' },
    { key: 'cartoes_exibir_probabilidade', label: 'Exibir probabilidade' },
    { key: 'cartoes_exibir_data_fechamento', label: 'Exibir data de fechamento prevista' },
    { key: 'cartoes_exibir_responsavel', label: 'Exibir responsável' },
    { key: 'cartoes_exibir_produto', label: 'Exibir produto' },
    { key: 'cartoes_exibir_tags', label: 'Exibir tags' },
    { key: 'cartoes_exibir_ultimo_contato', label: 'Exibir último contato' },
    { key: 'cartoes_exibir_tempo_etapa', label: 'Exibir tempo na etapa' },
    { key: 'cartoes_exibir_acoes', label: 'Exibir ações rápidas' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Cards do Pipeline</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a aparência e informações dos cards de oportunidades no pipeline
        </p>
      </div>

      <SettingCard title="Configurações Gerais">
        <div className="space-y-4">
          <SettingSelect
            label="Tamanho dos cartões"
            description="Define o tamanho padrão dos cards no pipeline"
            value={settings.cartoes_tamanho ?? 'medio'}
            options={[
              { value: 'pequeno', label: 'Pequeno' },
              { value: 'medio', label: 'Médio' },
              { value: 'grande', label: 'Grande' },
            ]}
            onValueChange={(value) => onSettingChange('cartoes_tamanho', value)}
          />
          
          <SettingSelect
            label="Ordenação das oportunidades"
            description="Como os cards serão ordenados dentro de cada etapa"
            value={settings.cartoes_ordenacao ?? 'data_cadastro'}
            options={[
              { value: 'data_cadastro', label: 'Data de cadastro' },
              { value: 'valor_desc', label: 'Maior valor' },
              { value: 'valor_asc', label: 'Menor valor' },
              { value: 'data_fechamento', label: 'Data de fechamento' },
              { value: 'alfabetica', label: 'Ordem alfabética' },
              { value: 'ultimo_contato', label: 'Último contato' },
            ]}
            onValueChange={(value) => onSettingChange('cartoes_ordenacao', value)}
          />
        </div>
      </SettingCard>

      <SettingCard title="Campos Exibidos nos Cards">
        <div className="divide-y">
          {displayOptions.map((option) => (
            <SettingSwitch
              key={option.key}
              label={option.label}
              checked={settings[option.key] ?? true}
              onCheckedChange={(checked) => onSettingChange(option.key, checked)}
            />
          ))}
        </div>
      </SettingCard>
    </div>
  );
}
