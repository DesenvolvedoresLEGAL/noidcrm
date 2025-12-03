import { useState } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useOrganizationTags, type Tag } from '@/hooks/useOrganizationTags';

interface TagsMultiSelectProps {
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export function TagsMultiSelect({ value, onChange, disabled }: TagsMultiSelectProps) {
  const { tags, createTag } = useOrganizationTags();
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedTags = tags.filter(t => value.includes(t.id));
  const availableTags = tags.filter(t => !value.includes(t.id));

  const handleToggleTag = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter(id => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(value.filter(id => id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    setCreating(true);
    const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const newTag = await createTag(newTagName.trim(), randomColor);
    
    if (newTag) {
      onChange([...value, newTag.id]);
      setNewTagName('');
      setShowCreateInput(false);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {selectedTags.length === 0 && (
          <span className="text-sm text-muted-foreground py-1">Nenhuma tag selecionada</span>
        )}
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="pl-2 pr-1 py-1 gap-1"
            style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color, color: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:bg-black/10 rounded p-0.5"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Add tags button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-8"
          >
            <TagIcon className="h-3.5 w-3.5 mr-1" />
            Adicionar Tags
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start">
          <div className="space-y-2">
            {/* Available tags */}
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ borderColor: tag.color, color: tag.color }}
                    onClick={() => handleToggleTag(tag.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}

            {availableTags.length === 0 && !showCreateInput && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Todas as tags já estão selecionadas
              </p>
            )}

            {/* Create new tag */}
            {showCreateInput ? (
              <div className="flex gap-2 pt-2 border-t">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Nome da tag"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || creating}
                >
                  {creating ? '...' : 'Criar'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-8 text-primary"
                onClick={() => setShowCreateInput(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Criar Nova Tag
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
