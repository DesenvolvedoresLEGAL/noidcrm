import React, { useEffect, useState } from 'react';
import { SettingCard } from '@/components/settings/SettingCard';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';

/**
 * Sprint 2.1 — Bloco de Metas de Receita
 *
 * Persiste em organization_settings.{monthly,quarterly,annual}_revenue_goal
 * (colunas dedicadas, não no JSONB `settings`).
 */
export function RevenueGoalsSection() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const [monthly, setMonthly] = useState<string>('0');
  const [quarterly, setQuarterly] = useState<string>('0');
  const [annual, setAnnual] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organization?.id) return;
      try {
        const { data, error } = await supabase
          .from('organization_settings')
          .select('monthly_revenue_goal, quarterly_revenue_goal, annual_revenue_goal')
          .eq('organization_id', organization.id)
          .maybeSingle();
        if (cancelled) return;
        if (error && error.code !== 'PGRST116') throw error;
        setMonthly(String(data?.monthly_revenue_goal ?? 0));
        setQuarterly(String(data?.quarterly_revenue_goal ?? 0));
        setAnnual(String(data?.annual_revenue_goal ?? 0));
      } catch (err) {
        console.error('[RevenueGoalsSection] load:', err);
        toast({
          title: 'Erro ao carregar metas',
          description: 'Não foi possível carregar as metas de receita.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [organization?.id, toast]);

  const handleSave = async () => {
    if (!organization?.id) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: organization.id,
        monthly_revenue_goal: Number(monthly) || 0,
        quarterly_revenue_goal: Number(quarterly) || 0,
        annual_revenue_goal: Number(annual) || 0,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('organization_settings')
        .upsert(payload, { onConflict: 'organization_id' });
      if (error) throw error;
      toast({
        title: 'Metas salvas',
        description: 'As metas de receita foram atualizadas.',
      });
    } catch (err) {
      console.error('[RevenueGoalsSection] save:', err);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as metas de receita.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingCard
      title="Metas de Receita"
      description="Definidas a nível de organização. Usadas pelos relatórios V2 (Forecast, Geral, Equipe)."
    >
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly_revenue_goal">Meta mensal (R$)</Label>
            <Input
              id="monthly_revenue_goal"
              type="number"
              min="0"
              step="0.01"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quarterly_revenue_goal">Meta trimestral (R$)</Label>
            <Input
              id="quarterly_revenue_goal"
              type="number"
              min="0"
              step="0.01"
              value={quarterly}
              onChange={(e) => setQuarterly(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annual_revenue_goal">Meta anual (R$)</Label>
            <Input
              id="annual_revenue_goal"
              type="number"
              min="0"
              step="0.01"
              value={annual}
              onChange={(e) => setAnnual(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar metas
              </>
            )}
          </Button>
        </div>
      </div>
    </SettingCard>
  );
}
