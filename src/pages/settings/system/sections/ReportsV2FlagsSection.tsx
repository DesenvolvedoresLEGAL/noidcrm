import React, { useEffect, useState } from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';

type SubKey = 'general' | 'losses' | 'forecast' | 'closer' | 'team' | 'stage_metrics';

const SUB_LABELS: Record<SubKey, { label: string; description: string }> = {
  general: { label: 'Geral V2', description: 'KPIs canônicos e win rate unificada' },
  losses: { label: 'Perdas V2', description: 'Análise canônica de motivos de perda' },
  forecast: { label: 'Forecast V2', description: 'Forecast com pipeline primário e meta real' },
  closer: { label: 'Closer V2', description: 'Performance Closer com fontes auditadas' },
  team: { label: 'Equipe V2', description: 'Performance de equipe canônica' },
  stage_metrics: { label: 'Métricas de Estágio V2', description: 'Requer stage_history (Sprint 2.2)' },
};

const DEFAULT_PAYLOAD = {
  general: false,
  losses: false,
  forecast: false,
  closer: false,
  team: false,
  stage_metrics: false,
};

/**
 * Sprint 2.1 — Painel admin de feature flags V2.
 * Master switch + 6 sub-toggles. Apenas admins podem editar (RLS).
 */
export function ReportsV2FlagsSection() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [payload, setPayload] = useState<Record<SubKey, boolean>>(DEFAULT_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organization?.id) return;
      try {
        const { data, error } = await supabase
          .from('organization_feature_flags')
          .select('enabled, payload')
          .eq('organization_id', organization.id)
          .eq('key', 'reports_v2_enabled')
          .maybeSingle();
        if (cancelled) return;
        if (error && error.code !== 'PGRST116') throw error;
        setEnabled(Boolean(data?.enabled));
        setPayload({ ...DEFAULT_PAYLOAD, ...((data?.payload ?? {}) as Partial<Record<SubKey, boolean>>) });
      } catch (err) {
        console.error('[ReportsV2FlagsSection] load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const persist = async (nextEnabled: boolean, nextPayload: Record<SubKey, boolean>) => {
    if (!organization?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organization_feature_flags')
        .upsert(
          {
            organization_id: organization.id,
            key: 'reports_v2_enabled',
            enabled: nextEnabled,
            payload: nextPayload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,key' }
        );
      if (error) throw error;
    } catch (err: any) {
      console.error('[ReportsV2FlagsSection] persist:', err);
      toast({
        title: 'Erro ao salvar flag',
        description: err?.message ?? 'Apenas administradores podem editar feature flags.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMaster = async (next: boolean) => {
    setEnabled(next);
    await persist(next, payload);
  };

  const handleSub = async (key: SubKey, next: boolean) => {
    const nextPayload = { ...payload, [key]: next };
    setPayload(nextPayload);
    await persist(enabled, nextPayload);
  };

  return (
    <div className="space-y-6">
      <SettingCard
        title="Master switch"
        description="Habilita o framework Reports V2 para esta organização. Os sub-toggles abaixo só têm efeito quando o master estiver ligado."
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <div>
              <Label className="text-base font-medium">reports_v2_enabled</Label>
              <p className="text-sm text-muted-foreground">
                Quando desligado, todas as telas usam a versão legada (LEGACY).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={enabled}
              onCheckedChange={handleMaster}
              disabled={loading || saving}
            />
          </div>
        </div>
      </SettingCard>

      <SettingCard
        title="Sub-toggles por relatório"
        description="Liberação granular. Ative um por vez para validar antes de expandir."
      >
        <div className="divide-y">
          {(Object.keys(SUB_LABELS) as SubKey[]).map((key) => (
            <div key={key} className="flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">{SUB_LABELS[key].label}</Label>
                  {!enabled && (
                    <Badge variant="outline" className="text-[10px]">
                      master desligado
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {SUB_LABELS[key].description}
                </p>
              </div>
              <Switch
                checked={payload[key]}
                onCheckedChange={(v) => handleSub(key, v)}
                disabled={loading || saving || !enabled}
              />
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );
}
