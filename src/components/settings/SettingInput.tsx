import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SettingInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'email';
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function SettingInput({
  label,
  description,
  value,
  onChange,
  type = 'text',
  disabled,
  placeholder,
  id,
}: SettingInputProps) {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <Input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full max-w-md"
      />
    </div>
  );
}
