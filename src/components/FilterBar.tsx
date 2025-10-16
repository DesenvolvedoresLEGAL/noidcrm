import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterBarProps {
  fields: FilterField[];
  onFilterChange?: (filters: Record<string, string>) => void;
  totalResults?: number;
}

interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
}

export function FilterBar({ fields, onFilterChange, totalResults }: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    const newFilters: Record<string, string> = {};
    fields.forEach(field => {
      const value = searchParams.get(field.key);
      if (value) newFilters[field.key] = value;
    });
    setFilters(newFilters);
  }, [searchParams, fields]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters };
    // "all" é tratado como "limpar filtro"
    if (value && value !== 'all') {
      newFilters[key] = value;
    } else {
      delete newFilters[key];
    }
    
    setFilters(newFilters);
    setSearchParams(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    setSearchParams({});
    onFilterChange?.({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {fields.map(field => (
          <div key={field.key} className="min-w-[200px]">
            {field.type === 'text' ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={field.label}
                  value={filters[field.key] || ''}
                  onChange={(e) => handleFilterChange(field.key, e.target.value)}
                  className="pl-9"
                />
              </div>
            ) : (
              <Select
                value={filters[field.key] || 'all'}
                onValueChange={(value) => handleFilterChange(field.key, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {field.options?.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
        
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {totalResults !== undefined && (
        <p className="text-sm text-muted-foreground">
          {totalResults} resultado{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
