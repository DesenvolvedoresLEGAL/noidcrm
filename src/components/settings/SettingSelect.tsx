import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SettingSelectProps {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function SettingSelect({
  label,
  description,
  value,
  options,
  onValueChange,
  disabled,
  placeholder = 'Selecione uma opção',
  id,
}: SettingSelectProps) {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={selectId} className="text-sm font-medium">
        {label}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={selectId} className="w-full max-w-md">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
