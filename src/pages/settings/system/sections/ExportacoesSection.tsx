import { SettingCard } from '@/components/settings/SettingCard';
import { SettingSwitch } from '@/components/settings/SettingSwitch';

interface ExportacoesSectionProps {
  settings: Record<string, boolean>;
  onSettingChange: (key: string, value: boolean) => void;
}

export function ExportacoesSection({ settings, onSettingChange }: ExportacoesSectionProps) {
  const exportOptions = [
    { key: 'exportar_oportunidades', label: 'Permitir exportação de oportunidades' },
    { key: 'exportar_pessoas', label: 'Permitir exportação de pessoas' },
    { key: 'exportar_empresas', label: 'Permitir exportação de empresas' },
    { key: 'exportar_pessoas_empresas', label: 'Permitir exportação de pessoas vinculadas a empresas' },
    { key: 'exportar_atividades', label: 'Permitir exportação de atividades' },
    { key: 'exportar_ligacoes', label: 'Permitir exportação de ligações' },
    { key: 'exportar_itens_oportunidades', label: 'Permitir exportação de itens vinculados em oportunidades' },
    { key: 'exportar_propostas', label: 'Permitir exportação de propostas' },
    { key: 'exportar_produtos', label: 'Permitir exportação de produtos' },
    { key: 'exportar_regioes', label: 'Permitir exportação de regiões' },
    { key: 'exportar_lista_dados', label: 'Permitir exportação de lista de dados' },
    { key: 'exportar_motivos_perda', label: 'Permitir exportação de motivos de perda' },
    { key: 'exportar_cidades', label: 'Permitir exportação de cidades' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Exportações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure as permissões de exportação de dados
        </p>
      </div>

      <SettingCard title="Permissões de Exportação">
        <div className="divide-y">
          {exportOptions.map((option) => (
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
