import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInlineButtonProps {
  onClick: () => Promise<void>;
  label?: string;
  size?: 'sm' | 'default';
  className?: string;
  disabled?: boolean;
}

export function AIInlineButton({ 
  onClick, 
  label = 'Gerar c/ IA',
  size = 'sm',
  className,
  disabled = false
}: AIInlineButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn(
        "gap-1.5 text-primary hover:text-primary hover:bg-primary/10 font-medium",
        size === 'sm' && "h-7 px-2 text-xs",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
