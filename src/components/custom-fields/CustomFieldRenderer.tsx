import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CustomField } from '@/services/crm/custom-fields';
import { formatFieldValue } from '@/services/crm/custom-fields';

interface CustomFieldRendererProps {
  field: CustomField;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  error?: string;
  mode?: 'edit' | 'view';
}

export function CustomFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
  error,
  mode = 'edit',
}: CustomFieldRendererProps) {
  if (mode === 'view') {
    return (
      <div className="space-y-1">
        <Label className="text-sm font-medium text-muted-foreground">
          {field.label}
        </Label>
        <p className="text-sm">{formatFieldValue(value, field)}</p>
      </div>
    );
  }

  const renderField = () => {
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <Input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.help_text || `Digite ${field.label.toLowerCase()}`}
            disabled={disabled}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.help_text || `Digite ${field.label.toLowerCase()}`}
            disabled={disabled}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder={field.help_text || '0'}
            disabled={disabled}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              value={value || ''}
              onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0,00"
              disabled={disabled}
              className="pl-10"
            />
          </div>
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={value === true}
              onCheckedChange={onChange}
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Sim' : 'Não'}
            </span>
          </div>
        );

      case 'date':
      case 'datetime':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !value && 'text-muted-foreground'
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), 'PPP', { locale: ptBR }) : 'Selecione uma data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => onChange(date?.toISOString())}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder={field.help_text || 'Selecione'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi_select':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {(field.options || []).map((option: any) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option.value]);
                    } else {
                      onChange(selectedValues.filter((v: string) => v !== option.value));
                    }
                  }}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`${field.id}-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'user':
        // This would need to be integrated with the organization users list
        return (
          <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {/* Users would be populated here */}
            </SelectContent>
          </Select>
        );

      case 'formula':
        return (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Campo calculado</p>
            <p className="text-sm font-medium">{formatFieldValue(value, field)}</p>
          </div>
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className={cn(
        "text-xs text-muted-foreground",
        field.is_required && "after:content-['*'] after:ml-0.5 after:text-destructive"
      )}>
        {field.label}
      </Label>
      {renderField()}
      {field.help_text && !error && (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
