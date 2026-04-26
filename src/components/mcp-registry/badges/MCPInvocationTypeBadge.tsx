import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import type { McpInvocationType } from '@/services/mcp-registry/types';

export function MCPInvocationTypeBadge({ type }: { type: McpInvocationType | string }) {
  if (type === 'real') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="gap-1 bg-destructive/10 text-destructive hover:bg-destructive/10" variant="secondary">
              <AlertTriangle className="h-3 w-3" />
              Real
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Registro real encontrado. Esta UI não executa ações reais.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <Badge className="gap-1" variant="secondary">
      <FlaskConical className="h-3 w-3" />
      Simulada
    </Badge>
  );
}
