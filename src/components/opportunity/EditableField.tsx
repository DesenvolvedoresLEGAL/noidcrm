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
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Only use debounce for text fields, not for dates/numbers
  const shouldDebounce = type === 'text' || type === 'textarea';
  const debouncedValue = useDebounce(editValue, 500);

  useEffect(() => {
    if (shouldDebounce && isEditing && debouncedValue !== value && debouncedValue !== '') {
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
        {label && <span className="text-xs text-muted-foreground block mb-1">{label}</span>}
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
              'border-primary',
              type === 'textarea' && 'min-h-[80px]'
            )}
          />
          {(isSaving || showSuccess) && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {showSuccess && <Check className="h-4 w-4 text-green-500" />}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative', className)}>
      {label && <span className="text-xs text-muted-foreground block mb-1">{label}</span>}
      <div
        className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors flex items-center gap-2"
        onClick={() => setIsEditing(true)}
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="flex-1">{displayValue || placeholder}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
      </div>
    </div>
  );
}
