import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, ClipboardCheck } from 'lucide-react';
import {
  auditCommercialDashboard,
  auditStatusLabel,
  type AuditStatus,
} from '@/services/crm/commercialDashboardAudit';
import type { ActiveCloserPilot, EligibleCloser } from '@/services/crm/closerDashboardObservability';

interface Props {
  tenantId: string;
  activePilots: ActiveCloserPilot[];
  eligibleClosers: EligibleCloser[];
}

const BADGE_VARIANT: Record<AuditStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  validated: 'default',
  empty: 'outline',
  unavailable: 'destructive',
  missing_source: 'destructive',
  review: 'secondary',
};

export function CloserDashboardAuditTable({ tenantId, activePilots, eligibleClosers }: Props) {
  const candidates: { id: string; label: string }[] = [
    ...activePilots.map((p) => ({
      id: p.userId,
      label: `${p.fullName ?? p.email ?? p.userId} · piloto ativo`,
    })),
    ...eligibleClosers.map((p) => ({
      id: p.userId,
      label: `${p.fullName ?? p.email ?? p.userId} · closer elegível`,
    })),
  ];

  const [userId, setUserId] = useState<string | null>(candidates[0]?.id ?? null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['commercial-dashboard-audit', tenantId, userId],
    queryFn: () => auditCommercialDashboard(tenantId, userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Auditoria de Dados
            </CardTitle>
            <CardDescription>
              Confere se cada métrica do Dashboard Comercial bate com a fonte real do CRM.
              Apenas leitura.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={userId ?? undefined}
              onValueChange={(v) => setUserId(v)}
              disabled={candidates.length === 0}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione um usuário comercial" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={!userId || isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Revalidar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!userId ? (
          <p className="text-sm text-muted-foreground">
            Nenhum usuário comercial disponível para auditoria.
          </p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Carregando auditoria...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead>Ação recomendada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.metric}>
                    <TableCell className="font-medium">{r.metric}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                    <TableCell>
                      <Badge variant={BADGE_VARIANT[r.status]}>{auditStatusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                      {r.observation}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                      {r.recommendation}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground mt-2">
              Última validação: {new Date(data.generatedAt).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
