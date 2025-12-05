import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronRight } from "lucide-react";

export interface SmartListItem {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  icon?: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
}

interface SmartListProps {
  title: string;
  icon?: LucideIcon;
  items: SmartListItem[];
  emptyMessage?: string;
  maxHeight?: string;
  showViewAll?: boolean;
  onViewAll?: () => void;
  className?: string;
}

export function SmartList({
  title,
  icon: HeaderIcon,
  items,
  emptyMessage = "Nenhum item encontrado",
  maxHeight = "300px",
  showViewAll = false,
  onViewAll,
  className,
}: SmartListProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {HeaderIcon && <HeaderIcon className="h-4 w-4 text-primary" />}
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          {showViewAll && onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              Ver tudo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea style={{ maxHeight }} className="pr-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {emptyMessage}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                    item.onClick && "cursor-pointer"
                  )}
                  onClick={item.onClick}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.icon && (
                      <item.icon
                        className={cn("h-4 w-4 shrink-0", item.iconColor || "text-muted-foreground")}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.value && (
                      <span className="text-sm font-semibold">{item.value}</span>
                    )}
                    {item.badge && (
                      <Badge variant={item.badge.variant || "secondary"}>
                        {item.badge.label}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
