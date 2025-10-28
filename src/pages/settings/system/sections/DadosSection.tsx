import React from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingSwitch } from '@/components/settings/SettingSwitch';
import { SettingSelect } from '@/components/settings/SettingSelect';
import { SettingInput } from '@/components/settings/SettingInput';

interface DadosSectionProps {
  settings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

export function DadosSection({ settings, onSettingChange }: DadosSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dados da Conta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configurações gerais da organização e preferências do sistema
        </p>
      </div>

      <Tabs defaultValue="configuracoes" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          <TabsTrigger value="regional">Regional</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracoes" className="space-y-4">
          <SettingCard title="Preferências Gerais">
            <div className="divide-y">
              <SettingSelect
                label="Fuso horário"
                description="Define o fuso horário para todas as datas e horários do sistema"
                value={settings.timezone ?? 'America/Sao_Paulo'}
                options={[
                  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
                  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
                  { value: 'America/Recife', label: 'Recife (GMT-3)' },
                  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
                ]}
                onValueChange={(value) => onSettingChange('timezone', value)}
              />
              
              <SettingSelect
                label="Idioma"
                description="Idioma padrão do sistema"
                value={settings.language ?? 'pt-BR'}
                options={[
                  { value: 'pt-BR', label: 'Português (Brasil)' },
                  { value: 'en-US', label: 'English (US)' },
                  { value: 'es-ES', label: 'Español' },
                ]}
                onValueChange={(value) => onSettingChange('language', value)}
              />

              <SettingSelect
                label="Formato de data"
                description="Como as datas serão exibidas no sistema"
                value={settings.date_format ?? 'DD/MM/YYYY'}
                options={[
                  { value: 'DD/MM/YYYY', label: 'DD/MM/AAAA (31/12/2024)' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/AAAA (12/31/2024)' },
                  { value: 'YYYY-MM-DD', label: 'AAAA-MM-DD (2024-12-31)' },
                ]}
                onValueChange={(value) => onSettingChange('date_format', value)}
              />
            </div>
          </SettingCard>

          <SettingCard title="Segurança e Privacidade">
            <div className="divide-y">
              <SettingSwitch
                label="Autenticação em dois fatores obrigatória"
                description="Exigir 2FA para todos os usuários da organização"
                checked={settings.require_2fa ?? false}
                onCheckedChange={(checked) => onSettingChange('require_2fa', checked)}
              />
              
              <SettingSwitch
                label="Registrar ações de usuários"
                description="Manter log de auditoria de todas as ações importantes"
                checked={settings.audit_log_enabled ?? true}
                onCheckedChange={(checked) => onSettingChange('audit_log_enabled', checked)}
              />
            </div>
          </SettingCard>
        </TabsContent>

        <TabsContent value="regional" className="space-y-4">
          <SettingCard title="Configurações Regionais">
            <div className="divide-y">
              <SettingSelect
                label="Moeda"
                description="Moeda padrão para valores monetários"
                value={settings.currency ?? 'BRL'}
                options={[
                  { value: 'BRL', label: 'Real (R$)' },
                  { value: 'USD', label: 'Dólar ($)' },
                  { value: 'EUR', label: 'Euro (€)' },
                ]}
                onValueChange={(value) => onSettingChange('currency', value)}
              />

              <SettingSelect
                label="Primeiro dia da semana"
                description="Dia que inicia a semana nos calendários"
                value={settings.week_start ?? 'monday'}
                options={[
                  { value: 'sunday', label: 'Domingo' },
                  { value: 'monday', label: 'Segunda-feira' },
                ]}
                onValueChange={(value) => onSettingChange('week_start', value)}
              />
            </div>
          </SettingCard>
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-4">
          <SettingCard title="Notificações por E-mail">
            <div className="divide-y">
              <SettingSwitch
                label="Notificações de novas oportunidades"
                description="Receber e-mail quando uma nova oportunidade for criada"
                checked={settings.email_new_opportunity ?? true}
                onCheckedChange={(checked) => onSettingChange('email_new_opportunity', checked)}
              />
              
              <SettingSwitch
                label="Notificações de atividades vencidas"
                description="Alertas diários sobre atividades pendentes"
                checked={settings.email_overdue_activities ?? true}
                onCheckedChange={(checked) => onSettingChange('email_overdue_activities', checked)}
              />
              
              <SettingSwitch
                label="Resumo semanal de vendas"
                description="Relatório semanal com métricas de performance"
                checked={settings.email_weekly_summary ?? false}
                onCheckedChange={(checked) => onSettingChange('email_weekly_summary', checked)}
              />
            </div>
          </SettingCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
