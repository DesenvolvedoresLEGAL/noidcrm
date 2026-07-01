import { useState } from 'react';
import { Check, ChevronDown, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  findGroupForTab,
  findItemForTab,
  kairosNavigationConfig,
  type KairosTabId,
} from './kairosNavigationConfig';

interface Props {
  activeTab: KairosTabId;
  onTabChange: (tab: KairosTabId) => void;
}

export function KairosPremiumNavigation({ activeTab, onTabChange }: Props) {
  const activeGroup = findGroupForTab(activeTab);
  const activeItem = findItemForTab(activeTab);

  return (
    <nav
      aria-label="Kairós navegação principal"
      className="border-b border-border/60 bg-card/60 backdrop-blur-sm rounded-lg"
    >
      {/* Desktop / Tablet */}
      <div className="hidden md:flex items-center gap-1 px-2 py-1.5">
        {kairosNavigationConfig.map((group) => {
          const isActive = activeGroup?.id === group.id;
          const Icon = group.icon;

          if (group.type === 'single') {
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onTabChange(group.tab)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 h-11 px-3 rounded-md text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{group.label}</span>
              </button>
            );
          }

          return (
            <DropdownMenu key={group.id}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isActive ? true : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 h-11 px-3 rounded-md text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{group.label}</span>
                  {isActive && activeItem ? (
                    <span className="hidden lg:inline text-xs text-primary/80">
                      · {activeItem.label}
                    </span>
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64" role="menu">
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const itemActive = item.tab === activeTab;
                  return (
                    <DropdownMenuItem
                      key={item.tab}
                      onSelect={() => onTabChange(item.tab)}
                      role="menuitem"
                      aria-current={itemActive ? 'page' : undefined}
                      className={cn(
                        'flex items-start gap-3 py-2.5 cursor-pointer',
                        itemActive && 'bg-primary/10 text-primary focus:bg-primary/15',
                      )}
                    >
                      <ItemIcon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.label}</span>
                          {itemActive && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <MobileNav activeTab={activeTab} onTabChange={onTabChange} />
      </div>
    </nav>
  );
}

function MobileNav({ activeTab, onTabChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeGroup = findGroupForTab(activeTab);
  const activeItem = findItemForTab(activeTab);

  const handleSelect = (tab: KairosTabId) => {
    onTabChange(tab);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-12"
          aria-label="Abrir menu do Kairós"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Menu className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate font-medium">
              {activeGroup?.label ?? 'Kairós'}
              {activeItem ? ` · ${activeItem.label}` : ''}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85%] max-w-sm p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Kairós</SheetTitle>
        </SheetHeader>
        <div className="p-2 overflow-y-auto max-h-[calc(100dvh-4rem)]" role="menu">
          {kairosNavigationConfig.map((group) => {
            const Icon = group.icon;
            if (group.type === 'single') {
              const isActive = group.tab === activeTab;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelect(group.tab)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-accent',
                  )}
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{group.label}</span>
                  {isActive && <Check className="h-4 w-4 ml-auto" aria-hidden />}
                </button>
              );
            }
            return (
              <div key={group.id} className="mt-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{group.label}</span>
                </div>
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const itemActive = item.tab === activeTab;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => handleSelect(item.tab)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm',
                        itemActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-accent',
                      )}
                      role="menuitem"
                      aria-current={itemActive ? 'page' : undefined}
                    >
                      <ItemIcon className="h-4 w-4" aria-hidden />
                      <span className="flex-1 text-left">{item.label}</span>
                      {itemActive && <Check className="h-4 w-4" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
