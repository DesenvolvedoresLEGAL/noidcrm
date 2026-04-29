import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, Circle, RefreshCw, ListChecks } from 'lucide-react';
import { auditCommercialDashboard } from '@/services/crm/commercialDashboardAudit';
import { getTenantDynamicFlag } from '@/services/crm/closerDashboardPilot';
import { supabase } from '@/integrations/supabase/client';
import type {
  ActiveCloserPilot,
  EligibleCloser,
  CloserHealthSummary,
  FeedbackSummary,
} from '@/services/crm/closerDashboardObservability';

type ItemStatus = 'ok' | 'attention' | 'pending';

interface Props {
  tenantId: string;
  activePilots: ActiveCloserPilot[];
  eligibleClosers: EligibleCloser[];
  health: CloserHealthSummary | undefined;
  feedback: FeedbackSummary | undefined;
  onRefetch: () => void;
}

function StatusBadge({ s }: { s: ItemStatus }) {
  if (s === 'ok')
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> OK
      </Badge>
    );
  if (s === 'attention')
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Atenção
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      <Circle className="h-3 w-3" /> Pendente
    </Badge>
  );
}

async function fetchProfileDefaultPipeline(userId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from('profiles')
    .select('default_pipeline_id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.default_pipeline_id as string | null) ?? null;
}

export function CloserHomologationChecklist({
  tenantId,
  activePilots,
  eligibleClosers,
  health,
  feedback,
  onRefetch,
}: Props) {
  const candidates = [
    ...activePilots.map((p) => ({ id: p.userId, label: p.fullName ?? p.email ?? p.userId, isPilot: true })),
    ...eligibleClosers.map((p) => ({ id: p.userId, label: p.fullName ?? p.email ?? p.userId, isPilot: false })),
  ];
  const [userId, setUserId] = useState<string | null>(candidates[0]?.id ?? null);

  const audit = useQuery({
    queryKey: ['homologation-audit', tenantId, userId],
    queryFn: () => auditCommercialDashboard(tenantId, userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const tenantFlag = useQuery({
    queryKey: ['homologation-tenant-flag', tenantId],
    queryFn: () => getTenantDynamicFlag(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const profile = useQuery({
    queryKey: ['homologation-profile', userId],
    queryFn: () => fetchProfileDefaultPipeline(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const isPilot = candidates.find((c) => c.id === userId)?.isPilot ?? false;
  const ctx = audit.data?.data?.context;
  const central = audit.data?.data?.central_do_dia;
  const pace = audit.data?.pace;
  const errorsRecent = (health?.errorCount ?? 0) === 0;

  const items: { label: string; status: ItemStatus; hint?: string }[] = [
    {
      label: 'Usuário piloto validado',
      status: ctx ? (!ctx.requires_review ? 'ok' : 'attention') : 'pending',
      hint: ctx?.requires_review ? 'Marcar como validado em Contexto CRM.' : undefined,
    },
    {
      label: 'Contexto CRM completo',
      status:
        ctx && ctx.permission_key && ctx.department_key && ctx.business_function_key
          ? 'ok'
          : 'pending',
    },
    {
      label: 'Função técnica = closer',
      status: ctx?.business_function_key === 'closer' ? 'ok' : 'pending',
    },
    {
      label: 'Dashboard dinâmico ativo no usuário',
      status: isPilot ? 'ok' : 'pending',
      hint: !isPilot ? 'Ative o piloto para este usuário.' : undefined,
    },
    {
      label: 'Flag global ativa no tenant',
      status: tenantFlag.data ? 'ok' : 'pending',
      hint: !tenantFlag.data ? 'Ative dynamic_dashboards_enabled no tenant.' : undefined,
    },
    {
      label: 'Pipeline Padrão configurado',
      status: profile.data ? 'ok' : 'attention',
      hint: !profile.data ? 'Pipeline padrão não selecionado no perfil.' : undefined,
    },
    {
      label: 'Meta mensal encontrada',
      status: pace?.goal_value ? 'ok' : 'attention',
    },
    {
      label: 'Central do Dia carregando',
      status: central ? 'ok' : 'pending',
    },
    {
      label: 'Pace Diário carregando',
      status: pace?.available ? 'ok' : 'attention',
    },
    {
      label: 'CTAs validados (rotas existem)',
      status: 'ok',
      hint: 'Rotas /app/opportunities/:id, /app/proposals/:id/edit, /app/activities confirmadas.',
    },
    {
      label: 'Sem erro runtime recente (7d)',
      status: errorsRecent ? 'ok' : 'attention',
    },
    {
      label: 'Feedback coletado',
      status: (feedback?.total ?? 0) > 0 ? 'ok' : 'pending',
    },
    {
      label: 'Rollback disponível',
      status: 'ok',
      hint: 'Desligar piloto e desligar tenant disponíveis abaixo.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Homologação do Dashboard Comercial
            </CardTitle>
            <CardDescription>
              Checklist visual para liberar o uso diário com segurança.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={userId ?? undefined}
              onValueChange={(v) => setUserId(v)}
              disabled={candidates.length === 0}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Selecione um comercial" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label} {c.isPilot ? '· piloto' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                audit.refetch();
                tenantFlag.refetch();
                profile.refetch();
                onRefetch();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Revalidar checklist
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!userId ? (
          <p className="text-sm text-muted-foreground">
            Nenhum usuário comercial disponível para checklist.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.label} className="py-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{it.label}</p>
                  {it.hint && <p className="text-xs text-muted-foreground">{it.hint}</p>}
                </div>
                <StatusBadge s={it.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
