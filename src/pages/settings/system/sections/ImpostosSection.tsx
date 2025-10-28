import { SettingCard } from '@/components/settings/SettingCard';
import { SettingSwitch } from '@/components/settings/SettingSwitch';
import { SettingSelect } from '@/components/settings/SettingSelect';

interface ImpostosSectionProps {
  settings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

export function ImpostosSection({ settings, onSettingChange }: ImpostosSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Impostos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os impostos para produtos e serviços
        </p>
      </div>

      <SettingCard title="Configurações de IPI">
        <div className="space-y-4">
          <SettingSwitch
            label="Habilitar IPI para Produtos"
            description="Ativar cálculo de IPI (Imposto sobre Produtos Industrializados)"
            checked={settings.impostos_habilitar_ipi ?? false}
            onCheckedChange={(checked) => onSettingChange('impostos_habilitar_ipi', checked)}
          />
          
          {settings.impostos_habilitar_ipi && (
            <SettingSelect
              label="Tipo de cálculo do IPI"
              description="Selecione como o IPI será calculado"
              value={settings.impostos_tipo_calculo_ipi ?? 'nao_destacado'}
              options={[
                { value: 'nao_destacado', label: 'Não Destacado' },
                { value: 'destacado', label: 'Destacado' },
                { value: 'por_dentro', label: 'Por Dentro' },
              ]}
              onValueChange={(value) => onSettingChange('impostos_tipo_calculo_ipi', value)}
            />
          )}
        </div>
      </SettingCard>
    </div>
  );
}
