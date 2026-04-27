import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  pages?: Array<{ url: string; source_type?: string; length?: number }>;
}

export function FallbackIndicator({ pages = [] }: Props) {
  const hasPages = pages.length > 0;
  const content = (
    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1">
      <AlertTriangle className="h-3 w-3" />
      <span>Dados complementados via fallback</span>
      {hasPages && <span className="opacity-70">· {pages.length} página{pages.length > 1 ? 's' : ''}</span>}
    </div>
  );

  if (!hasPages) return content;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="text-xs space-y-1">
            <div className="font-semibold">Páginas complementares:</div>
            {pages.map((p, i) => (
              <div key={i} className="truncate opacity-80">{p.url}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
