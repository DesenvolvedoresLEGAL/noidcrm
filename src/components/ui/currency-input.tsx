import { useState, useEffect, useRef } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

// Format number to Brazilian currency string (without R$ symbol)
function formatToBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Parse Brazilian currency string to number
function parseBRL(value: string): number {
  // Remove all non-numeric characters except comma and minus
  const cleaned = value.replace(/[^\d,-]/g, '');
  // Replace comma with dot for parsing
  const normalized = cleaned.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export function CurrencyInput({ value, onChange, className, disabled, placeholder = "0,00" }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatToBRL(value || 0));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display when external value changes (and not focused)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatToBRL(value || 0));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Select all text on focus for easy editing
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numericValue = parseBRL(displayValue);
    setDisplayValue(formatToBRL(numericValue));
    onChange(numericValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Allow typing with Brazilian format
    // Only allow digits, comma, dot, and minus
    const sanitized = rawValue.replace(/[^\d.,-]/g, '');
    setDisplayValue(sanitized);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      className={cn("text-right", className)}
    />
  );
}
