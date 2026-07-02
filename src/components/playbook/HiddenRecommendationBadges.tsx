import { Badge } from '@/components/ui/badge';
import { AlertCircle, Building2, Briefcase, Phone } from 'lucide-react';

const REASON_MAP: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  domain_mismatch: {
    label: 'Domínio não bate',
    icon: Building2,
    tone: 'border-amber-500/40 text-amber-700 bg-amber-500/10',
  },
  role_mismatch: {
    label: 'Cargo diferente do solicitado',
    icon: Briefcase,
    tone: 'border-blue-500/40 text-blue-700 bg-blue-500/10',
  },
  company_phone_only: {
    label: 'Apenas telefone corporativo',
    icon: Phone,
    tone: 'border-orange-500/40 text-orange-700 bg-orange-500/10',
  },
};

interface Props {
  reasons?: string[] | null;
  className?: string;
}

/**
 * KAI.18.5 — Badges de recomendação (nunca ocultam o contato).
 * Mostra por que o Kairós não recomenda esse contato, mas ele continua visível.
 */
export function HiddenRecommendationBadges({ reasons, className }: Props) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {reasons.map((r) => {
        const meta = REASON_MAP[r] ?? {
          label: r,
          icon: AlertCircle,
          tone: 'border-muted-foreground/30 text-muted-foreground bg-muted/40',
        };
        const Icon = meta.icon;
        return (
          <Badge key={r} variant="outline" className={`gap-1 text-[10px] ${meta.tone}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        );
      })}
    </div>
  );
}
