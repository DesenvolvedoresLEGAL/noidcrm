import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { SystemSettingsSidebar } from './SystemSettingsSidebar';
import { DadosSection } from './sections/DadosSection';
import { ExportacoesSection } from './sections/ExportacoesSection';
import { ForecastSection } from './sections/ForecastSection';
import { ImpostosSection } from './sections/ImpostosSection';
import { NotasSection } from './sections/NotasSection';
import { OportunidadesCartoesSection } from './sections/OportunidadesCartoesSection';
import { PropostasSiglasSection } from './sections/PropostasSiglasSection';
import { RelatoriosSection } from './sections/RelatoriosSection';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function SystemSettings() {
  const [activeSection, setActiveSection] = useState('exportacoes');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { organization } = useCurrentOrganization();
  const { toast } = useToast();
  const debouncedSettings = useDebounce(settings, 1000);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!organization?.id) return;

      try {
        const { data, error } = await supabase
          .from('organization_settings')
          .select('settings')
          .eq('organization_id', organization.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data?.settings) {
          setSettings(data.settings as Record<string, any>);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Erro ao carregar configurações',
          description: 'Não foi possível carregar as configurações do sistema.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [organization?.id]);

  // Auto-save settings
  useEffect(() => {
    async function saveSettings() {
      if (!organization?.id || isLoading) return;

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('organization_settings')
          .upsert({
            organization_id: organization.id,
            settings: debouncedSettings,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;

        toast({
          title: 'Configurações salvas',
          description: 'As alterações foram salvas automaticamente.',
        });
      } catch (error) {
        console.error('Error saving settings:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar as configurações.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }

    if (Object.keys(debouncedSettings).length > 0) {
      saveSettings();
    }
  }, [debouncedSettings, organization?.id, isLoading]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  const renderSection = () => {
    const props = { settings, onSettingChange: handleSettingChange };

    switch (activeSection) {
      case 'dados':
        return <DadosSection {...props} />;
      case 'exportacoes':
        return <ExportacoesSection {...props} />;
      case 'forecast':
        return <ForecastSection {...props} />;
      case 'impostos':
        return <ImpostosSection {...props} />;
      case 'notas':
        return <NotasSection {...props} />;
      case 'oportunidades-cartoes':
        return <OportunidadesCartoesSection {...props} />;
      case 'propostas-siglas':
        return <PropostasSiglasSection {...props} />;
      case 'relatorios':
        return <RelatoriosSection {...props} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Seção em desenvolvimento</p>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="flex h-full w-full">
        <SystemSettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {isSaving && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner />
                <span>Salvando...</span>
              </div>
            )}
            {renderSection()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
