import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  label?: string;
  value: unknown;
  onChange: (parsed: unknown, valid: boolean) => void;
  rows?: number;
  fallback?: 'object' | 'array';
  required?: boolean;
  helperText?: string;
  className?: string;
}

/**
 * Editor JSON simples com validação. Bloqueia submissão pelo pai via flag `valid`.
 * Se vazio, devolve {} (ou [] se fallback="array").
 */
export function MCPJsonEditor({
  label,
  value,
  onChange,
  rows = 6,
  fallback = 'object',
  required = false,
  helperText,
  className,
}: Props) {
  const [text, setText] = useState<string>(() => {
    try {
      return value === undefined || value === null ? '' : JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza valor externo
    try {
      const next = value === undefined || value === null ? '' : JSON.stringify(value, null, 2);
      setText((prev) => (prev === next ? prev : next));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value ?? null)]);

  const handleChange = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      setError(null);
      onChange(fallback === 'array' ? [] : {}, true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (fallback === 'array' && !Array.isArray(parsed)) {
        setError('JSON deve ser um array.');
        onChange(parsed, false);
        return;
      }
      setError(null);
      onChange(parsed, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido');
      onChange(null, false);
    }
  };

  const isValid = !error && (text.trim() !== '' || !required);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">{label}</Label>
          <span className="text-xs flex items-center gap-1">
            {error ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Inválido
              </span>
            ) : isValid && text.trim() !== '' ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Válido
              </span>
            ) : (
              <span className="text-muted-foreground">Vazio</span>
            )}
          </span>
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={rows}
        className={cn('font-mono text-xs', error && 'border-destructive focus-visible:ring-destructive')}
        placeholder={fallback === 'array' ? '[]' : '{}'}
        spellCheck={false}
      />
      {(error || helperText) && (
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{error || helperText}</p>
      )}
    </div>
  );
}
