import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Loader2, Check, MapPin, Type, DollarSign, Calendar, Mail, Phone, Link, Hash, ToggleLeft, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import type { CustomField } from '@/services/crm/custom-fields';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EditableCustomFieldProps {
  field: CustomField;
  value: any;
  onSave: (value: any) => Promise<void>;
  className?: string;
}

const fieldTypeIcons: Record<string, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  textarea: <Type className="h-3.5 w-3.5" />,
  number: <Hash className="h-3.5 w-3.5" />,
  currency: <DollarSign className="h-3.5 w-3.5" />,
  date: <Calendar className="h-3.5 w-3.5" />,
  datetime: <Calendar className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  url: <Link className="h-3.5 w-3.5" />,
  boolean: <ToggleLeft className="h-3.5 w-3.5" />,
  select: <List className="h-3.5 w-3.5" />,
  multi_select: <List className="h-3.5 w-3.5" />,
};

// Check if field label contains location-related keywords
const isLocationField = (label: string): boolean => {
  const keywords = ['endereço', 'endereco', 'address', 'localização', 'localizacao', 'location', 'rua', 'avenida', 'cep'];
  return keywords.some(keyword => label.toLowerCase().includes(keyword));
};

export function EditableCustomField({
  field,
  value,
  onSave,
  className,
}: EditableCustomFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Determine if should use debounce (text fields including location fields used as textarea)
  const shouldDebounce = field.field_type === 'text' || field.field_type === 'textarea';
  const useTextareaForField = field.field_type === 'textarea' || isLocationField(field.label);

  // Update local value when prop changes
  useEffect(() => {
    setEditValue(value ?? '');
  }, [value]);

  // Debounced save for text fields
  useEffect(() => {
    if (shouldDebounce && isEditing && debouncedValue !== (value ?? '') && debouncedValue !== '') {
      handleSave(debouncedValue);
    }
  }, [debouncedValue, shouldDebounce]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (field.field_type !== 'textarea') {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleSave = async (newValue: any) => {
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsEditing(false);
      }, 1000);
    } catch (error) {
      console.error('Error saving custom field:', error);
      setEditValue(value ?? '');
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && field.field_type !== 'textarea') {
      e.preventDefault();
      handleSave(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(value ?? '');
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (!isSaving && !shouldDebounce) {
      if (editValue !== value && editValue !== '') {
        handleSave(editValue);
      } else {
        setIsEditing(false);
      }
    } else if (!isSaving) {
      setIsEditing(false);
    }
  };

  // Format display value based on field type
  const getDisplayValue = (): string => {
    if (value === null || value === undefined || value === '') {
      return field.help_text || 'Não informado';
    }

    switch (field.field_type) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(value));
      case 'date':
        try {
          return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
        } catch {
          return String(value);
        }
      case 'datetime':
        try {
          return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
          return String(value);
        }
      case 'boolean':
        return value ? 'Sim' : 'Não';
      case 'select':
        // Try to find label from options
        if (field.options && Array.isArray(field.options)) {
          const option = field.options.find((opt: any) => opt.value === value);
          return option?.label || String(value);
        }
        return String(value);
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      default:
        return String(value);
    }
  };

  // Get icon based on field type or label
  const getIcon = (): React.ReactNode => {
    if (isLocationField(field.label)) {
      return <MapPin className="h-3.5 w-3.5" />;
    }
    return fieldTypeIcons[field.field_type] || <Type className="h-3.5 w-3.5" />;
  };

  // Get input type for HTML input
  const getInputType = (): string => {
    switch (field.field_type) {
      case 'number':
      case 'currency':
        return 'number';
      case 'date':
        return 'date';
      case 'datetime':
        return 'datetime-local';
      case 'email':
        return 'email';
      case 'phone':
        return 'tel';
      case 'url':
        return 'url';
      default:
        return 'text';
    }
  };

  // Determine if this field should use textarea (explicit textarea type OR location fields)
  const useTextarea = field.field_type === 'textarea' || isLocationField(field.label);

  // Handle keyboard for textarea fields (Ctrl+Enter to save)
  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(value ?? '');
      setIsEditing(false);
    }
  };

  // Render editing mode
  if (isEditing) {
    const isTextareaMode = useTextarea;
    const InputComponent = isTextareaMode ? Textarea : Input;

    return (
      <div className={cn('relative', className)}>
        <span className="text-[11px] text-muted-foreground block leading-tight">{field.label}</span>
        <div className="relative mt-0.5">
          <InputComponent
            ref={inputRef as any}
            type={isTextareaMode ? undefined : getInputType()}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={isTextareaMode ? handleTextareaKeyDown : handleKeyDown}
            onBlur={handleBlur}
            placeholder={field.help_text || (isLocationField(field.label) ? 'Digite o endereço completo...' : '')}
            className={cn(
              'border-primary text-xs',
              isTextareaMode ? 'min-h-[70px] py-1.5 px-2 text-xs leading-relaxed' : 'h-7'
            )}
          />
          <div className="flex items-center justify-between mt-0.5">
            {isTextareaMode && (
              <span className="text-[10px] text-muted-foreground">Ctrl+Enter para salvar</span>
            )}
            {(isSaving || showSuccess) && (
              <div className="ml-auto">
                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {showSuccess && <Check className="h-3 w-3 text-green-500" />}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render display mode (same pattern as EditableField)
  const displayValue = getDisplayValue();
  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div className={cn('group relative', className)}>
      <span className="text-[11px] text-muted-foreground block leading-tight">{field.label}</span>
      <div
        className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors flex items-center gap-1.5"
        onClick={() => setIsEditing(true)}
      >
        <span className="text-muted-foreground">{getIcon()}</span>
        <span className={cn(
          "flex-1 text-xs leading-snug",
          isEmpty ? "text-muted-foreground italic" : "font-medium"
        )}>
          {displayValue}
        </span>
        <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity flex-shrink-0" />
      </div>
    </div>
  );
}
