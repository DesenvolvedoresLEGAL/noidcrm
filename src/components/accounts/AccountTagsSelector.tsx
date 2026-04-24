import { useState, useMemo } from 'react';
import { Check, Plus, X, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useOrganizationTags, type Tag } from '@/hooks/useOrganizationTags';

interface AccountTagsSelectorProps {
  value: string[]; // tag ids selecionadas
  onChange: (tagIds: string[]) => void;
}

const PRESET_COLORS = ['#F97316', '#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4'];

export function AccountTagsSelector({ value, onChange }: AccountTagsSelectorProps) {
  const { tags, loading, createTag } = useOrganizationTags();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => tags.filter((t) => value.includes(t.id)),
    [tags, value],
  );

  const toggle = (tagId: string) => {
    if (value.includes(tagId)) onChange(value.filter((id) => id !== tagId));
    else onChange([...value, tagId]);
  };

  const remove = (tagId: string) => onChange(value.filter((id) => id !== tagId));

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      const newTag = await createTag(name, color);
      if (newTag) {
        onChange([...value, newTag.id]);
        setSearch('');
      }
    } finally {
      setCreating(false);
    }
  };

  const matchesExisting = tags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase(),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhuma tag selecionada</span>
        )}
        {selected.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="gap-1 pl-2 pr-1 py-0.5"
            style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
          >
            <TagIcon className="h-3 w-3" />
            {tag.name}
            <button
              type="button"
              onClick={() => remove(tag.id)}
              className="ml-0.5 hover:bg-foreground/10 rounded-full p-0.5"
              aria-label={`Remover ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="Buscar ou criar tag..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() && !matchesExisting ? (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                  >
                    <Plus className="h-4 w-4" />
                    Criar tag "{search.trim()}"
                  </button>
                ) : (
                  <span className="px-3 py-2 text-sm text-muted-foreground">
                    {loading ? 'Carregando...' : 'Nenhuma tag encontrada'}
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const isSelected = value.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggle(tag.id)}
                      className="gap-2"
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      {isSelected && <Check className="h-4 w-4" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface AccountTagsBadgesProps {
  tags: { id: string; name: string; color: string }[];
  max?: number;
}

export function AccountTagsBadges({ tags, max = 3 }: AccountTagsBadgesProps) {
  if (!tags || tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-xs gap-1 px-1.5 py-0"
          style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}50` }}
        >
          <TagIcon className="h-2.5 w-2.5" />
          {tag.name}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          +{extra}
        </Badge>
      )}
    </div>
  );
}
