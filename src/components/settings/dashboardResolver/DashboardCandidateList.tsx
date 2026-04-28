import { Check, X } from 'lucide-react';
import type { DashboardCandidate } from '@/services/crm/dashboardProfiles';

const SCOPE_LABELS: Record<string, string> = {
  user: 'Usuário',
  business_function: 'Função',
  department: 'Área',
  permission_role: 'Permissão',
  default: 'Padrão',
};

export function DashboardCandidateList({ candidates }: { candidates: DashboardCandidate[] }) {
  if (!candidates?.length) {
    return <p className="text-sm text-muted-foreground">Nenhum candidato avaliado.</p>;
  }
  return (
    <ol className="space-y-2">
      {candidates.map((c, idx) => (
        <li
          key={`${c.scope_type}-${idx}`}
          className="flex items-center gap-3 rounded border bg-muted/30 px-3 py-2 text-sm"
        >
          <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
          {c.matched ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{SCOPE_LABELS[c.scope_type] || c.scope_type}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono text-xs">{c.scope_key ?? '—'}</span>
          {c.matched && c.profile_key && (
            <span className="ml-auto text-xs text-emerald-700">{c.profile_key}</span>
          )}
          {!c.matched && c.reason && (
            <span className="ml-auto text-xs text-muted-foreground">{c.reason}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
