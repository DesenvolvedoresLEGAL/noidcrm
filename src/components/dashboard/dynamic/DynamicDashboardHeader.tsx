import { Badge } from '@/components/ui/badge';
import type { NormalizedShell } from '@/hooks/dashboard/useDynamicDashboardShell';

const SCOPE_LABELS: Record<string, string> = {
  user: 'Usuário',
  business_function: 'Função',
  department: 'Área',
  permission_role: 'Permissão',
  default: 'Padrão',
};

function badgeVariant(label: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (label === 'Owner Cockpit' || label === 'Admin Center') return 'default';
  if (label === 'Fallback') return 'destructive';
  if (label === 'Preview') return 'secondary';
  return 'outline';
}

export function DynamicDashboardHeader({ shell }: { shell: NormalizedShell }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold truncate">{shell.safeTitle}</h3>
          {shell.safeDescription && (
            <p className="text-sm text-muted-foreground">{shell.safeDescription}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {shell.badges.map((b) => (
            <Badge key={b} variant={badgeVariant(b)}>{b}</Badge>
          ))}
        </div>
      </div>
      {(shell.scopeType || shell.scopeKey) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {shell.scopeType && (
            <span>
              Escopo: <strong>{SCOPE_LABELS[shell.scopeType] || shell.scopeType}</strong>
            </span>
          )}
          {shell.scopeKey && (
            <span>
              Chave: <span className="font-mono">{shell.scopeKey}</span>
            </span>
          )}
          <span>
            Uso real: <strong>Não</strong>
          </span>
        </div>
      )}
    </div>
  );
}
