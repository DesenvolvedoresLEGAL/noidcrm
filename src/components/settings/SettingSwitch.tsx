import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SettingSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function SettingSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: SettingSwitchProps) {
  const switchId = id || `switch-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 space-y-1">
        <Label 
          htmlFor={switchId}
          className="text-sm font-medium leading-none cursor-pointer"
        >
          {label}
        </Label>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
