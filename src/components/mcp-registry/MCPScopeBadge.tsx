import { Badge } from '@/components/ui/badge';
import { Globe, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MCPScopeBadge({ orgId, currentOrgId, className }: { orgId: string | null; currentOrgId: string | null; className?: string }) {
  const isGlobal = orgId === null;
  return (
    <Badge variant="outline" className={cn('font-medium gap-1', className)}>
      {isGlobal ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      {isGlobal ? 'Global' : 'Organização'}
    </Badge>
  );
}
