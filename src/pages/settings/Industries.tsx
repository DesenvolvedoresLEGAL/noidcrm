import { IndustriesSettings } from '@/components/settings/IndustriesSettings';

export default function Industries() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Indústrias e Segmentos</h1>
        <p className="text-muted-foreground">
          Configure as indústrias disponíveis para seleção no onboarding e cadastros
        </p>
      </div>
      <IndustriesSettings />
    </div>
  );
}
