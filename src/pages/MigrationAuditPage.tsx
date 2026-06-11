/**
 * Sprint RCC V3.9 — Página de auditoria da migração do consumo executivo
 * para o Revenue Command Center.
 *
 * Acessível em /app/revenue-command/migration-audit. Apenas leitura.
 */
import { Layout } from '@/components/Layout';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { useRevenueCommandMigrationAudit } from '@/hooks/revenue-command/useRevenueCommandMigrationAudit';
import { RevenueCommandMigrationMap } from '@/components/revenue-command/migration/RevenueCommandMigrationMap';
import { RevenueCommandDependencyMap } from '@/components/revenue-command/migration/RevenueCommandDependencyMap';
import { RevenueCommandDuplicateMetrics } from '@/components/revenue-command/migration/RevenueCommandDuplicateMetrics';

export default function MigrationAuditPage() {
  const { data } = useRevenueCommandMigrationAudit();

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Auditoria de migração — Revenue Command"
          description="Mapa do que já vive dentro do RCC, o que ainda depende dos módulos legados e quais métricas continuam duplicadas."
          icon={ShieldCheck}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryStat label="Migradas"   value={data.meta.totals.migrated} tone="emerald" />
          <SummaryStat label="Parciais"   value={data.meta.totals.partial} tone="amber" />
          <SummaryStat label="Não migradas" value={data.meta.totals.notMigrated} tone="muted" />
        </div>

        <RevenueCommandMigrationMap entries={data.all} />
        <RevenueCommandDependencyMap dependencies={data.dependencies} />
        <RevenueCommandDuplicateMetrics duplicates={data.duplicates} />
      </PageContainer>
    </Layout>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'muted';
}) {
  const cls =
    tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' :
    tone === 'amber' ? 'text-amber-700 dark:text-amber-400' :
    'text-muted-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-3xl font-bold ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
