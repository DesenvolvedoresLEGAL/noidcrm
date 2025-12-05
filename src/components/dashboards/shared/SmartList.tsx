import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronRight, Inbox } from "lucide-react";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3 }
  },
};

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 h-full",
        "bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          {HeaderIcon && (
            <div className="p-1.5 rounded-lg bg-primary/10">
              <HeaderIcon className="h-4 w-4 text-primary" />
            </div>
          )}
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary" className="text-xs px-2 py-0 h-5">
            {items.length}
          </Badge>
        </div>
        {showViewAll && onViewAll && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            className="text-xs hover:text-primary group"
          >
            Ver tudo
            <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 pt-3">
        <ScrollArea style={{ maxHeight }} className="pr-3">
          {items.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="p-3 rounded-full bg-muted/50 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  whileHover={{ 
                    x: 4,
                    backgroundColor: "hsl(var(--accent) / 0.5)",
                    transition: { duration: 0.2 }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    "border border-transparent bg-muted/30",
                    "transition-all duration-200",
                    item.onClick && "cursor-pointer"
                  )}
                  onClick={item.onClick}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.icon && (
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        item.iconColor 
                          ? `${item.iconColor.replace("text-", "bg-").replace("500", "500/15")}` 
                          : "bg-muted"
                      )}>
                        <item.icon
                          className={cn("h-3.5 w-3.5", item.iconColor || "text-muted-foreground")}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.value && (
                      <span className="text-sm font-bold">{item.value}</span>
                    )}
                    {item.badge && (
                      <Badge 
                        variant={item.badge.variant || "secondary"}
                        className="text-xs"
                      >
                        {item.badge.label}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </ScrollArea>
      </div>
    </motion.div>
  );
}
