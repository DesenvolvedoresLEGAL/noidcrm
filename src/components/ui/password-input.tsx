import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showStrength?: boolean;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength = false, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [strength, setStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

    const calculateStrength = (password: string) => {
      if (!password) return null;
      
      let score = 0;
      if (password.length >= 8) score++;
      if (/[a-z]/.test(password)) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      
      if (score <= 2) return 'weak';
      if (score <= 4) return 'medium';
      return 'strong';
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (showStrength) {
        setStrength(calculateStrength(value));
      }
      props.onChange?.(e);
    };

    const strengthColors = {
      weak: 'bg-destructive',
      medium: 'bg-warning',
      strong: 'bg-success',
    };

    const strengthLabels = {
      weak: 'Fraca',
      medium: 'Média',
      strong: 'Forte',
    };

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            className={cn('pr-10', className)}
            ref={ref}
            {...props}
            onChange={handlePasswordChange}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        
        {showStrength && strength && (
          <div className="space-y-1">
            <div className="flex gap-1">
              <div className={cn('h-1 flex-1 rounded-full transition-colors', 
                strength ? strengthColors[strength] : 'bg-muted'
              )} />
              <div className={cn('h-1 flex-1 rounded-full transition-colors',
                strength === 'medium' || strength === 'strong' ? strengthColors[strength] : 'bg-muted'
              )} />
              <div className={cn('h-1 flex-1 rounded-full transition-colors',
                strength === 'strong' ? strengthColors[strength] : 'bg-muted'
              )} />
            </div>
            <p className="text-xs text-muted-foreground">
              Força da senha: <span className="font-medium">{strengthLabels[strength]}</span>
            </p>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
