import { Radar, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

/**
 * Sprint REVOPS V3.0 — Header oficial do Revenue Command Center.
 * Substitui a linguagem genérica de "Dashboard de BI".
 */
export function RevenueCommandHeader() {
  return (
    <PageHeader
      icon={Radar}
      title="Revenue Command Center"
      subtitle="Centro de decisão comercial da operação."
      variant="indigo"
      badge={{ label: 'Beta', icon: Sparkles }}
    />
  );
}
