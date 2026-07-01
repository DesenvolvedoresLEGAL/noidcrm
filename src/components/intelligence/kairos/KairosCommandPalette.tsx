import { useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { kairosNavigationConfig, type KairosTabId } from './kairosNavigationConfig';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: KairosTabId) => void;
}

export function KairosCommandPalette({ open, onOpenChange, onNavigate }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const handleSelect = (tab: KairosTabId) => {
    onNavigate(tab);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulo… (Nova Busca, Queue, Autopilot, Skills…)" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        {kairosNavigationConfig.map((group, idx) => (
          <div key={group.id}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group.label}>
              {group.type === 'single' ? (
                <CommandItem
                  value={`${group.label}`}
                  onSelect={() => handleSelect(group.tab)}
                >
                  <group.icon className="h-4 w-4 mr-2" aria-hidden />
                  {group.label}
                </CommandItem>
              ) : (
                group.items.map((item) => (
                  <CommandItem
                    key={item.tab}
                    value={`${group.label} ${item.label} ${item.description ?? ''}`}
                    onSelect={() => handleSelect(item.tab)}
                  >
                    <item.icon className="h-4 w-4 mr-2" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.description && (
                      <span className="ml-2 text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.description}
                      </span>
                    )}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
