import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface EditableFieldProps {
  value: string | number;
  onSave: (newValue: any) => Promise<void>;
  type?: 'text' | 'number' | 'currency' | 'date' | 'textarea';
  label?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  displayFormatter?: (value: any) => string;
}

export function EditableField({
  value,
  onSave,
  type = 'text',
  label,
  icon,
  placeholder,
  className,
  displayFormatter,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Convert date values to proper format for input
  const getEditValue = () => {
    if (type === 'date' && value) {
      // Se já é string YYYY-MM-DD, retornar direto
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      // Se for Date ou timestamp, converter para YYYY-MM-DD local
      const date = new Date(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return value;
  };
  
  const [editValue, setEditValue] = useState(getEditValue());
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Only use debounce for text fields, not for dates/numbers
  const shouldDebounce = type === 'text' || type === 'textarea';
  const debouncedValue = useDebounce(editValue, 500);

  useEffect(() => {
    if (shouldDebounce && isEditing && debouncedValue !== getEditValue() && debouncedValue !== '') {
      handleSave(debouncedValue);
    }
  }, [debouncedValue, shouldDebounce]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== 'textarea') {
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
      console.error('Error saving field:', error);
      setEditValue(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (!isSaving && !shouldDebounce) {
      // For date/number fields, save on blur
      if (editValue !== value && editValue !== '') {
        handleSave(editValue);
      } else {
        setIsEditing(false);
      }
    } else if (!isSaving) {
      setIsEditing(false);
    }
  };

  const displayValue = displayFormatter ? displayFormatter(value) : String(value);

  if (isEditing) {
    const InputComponent = type === 'textarea' ? Textarea : Input;
    return (
      <div className={cn('relative', className)}>
        {label && <span className="text-[10px] text-muted-foreground block leading-none">{label}</span>}
        <div className="relative">
          <InputComponent
            ref={inputRef as any}
            type={type === 'currency' ? 'number' : type === 'date' ? 'date' : type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={cn(
              'border-primary h-7 text-xs',
              type === 'textarea' && 'min-h-[60px]'
            )}
          />
          {(isSaving || showSuccess) && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {showSuccess && <Check className="h-3 w-3 text-green-500" />}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative', className)}>
      {label && <span className="text-[10px] text-muted-foreground block leading-none">{label}</span>}
      <div
        className="cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors flex items-center gap-1.5"
        onClick={() => setIsEditing(true)}
      >
        {icon && <span className="text-muted-foreground [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
        <span className="flex-1 text-xs font-medium leading-tight">{displayValue || placeholder}</span>
        <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
      </div>
    </div>
  );
}
