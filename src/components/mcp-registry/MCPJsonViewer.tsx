import { cn } from '@/lib/utils';

interface Props {
  value: unknown;
  className?: string;
  maxHeight?: string;
}

export function MCPJsonViewer({ value, className, maxHeight = '300px' }: Props) {
  let formatted = '';
  try {
    formatted = JSON.stringify(value ?? {}, null, 2);
  } catch {
    formatted = String(value ?? '');
  }
  return (
    <pre
      className={cn(
        'rounded-md border bg-muted/40 p-3 text-xs font-mono overflow-auto whitespace-pre',
        className,
      )}
      style={{ maxHeight }}
    >
      {formatted}
    </pre>
  );
}
