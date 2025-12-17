import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  path: string;
}

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  items: SettingsItem[];
}

interface SettingsCategoryCardProps {
  category: SettingsCategory;
  onNavigate: (path: string) => void;
}

export function SettingsCategoryCard({ category, onNavigate }: SettingsCategoryCardProps) {
  const CategoryIcon = category.icon;

  return (
    <Card className="group overflow-hidden border-border/50 hover:border-border hover:shadow-lg transition-all duration-300">
      <CardHeader className={cn("pb-3 bg-gradient-to-br", category.color)}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-background/80 backdrop-blur flex items-center justify-center shadow-sm">
            <CategoryIcon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{category.title}</h3>
            <p className="text-xs text-muted-foreground">{category.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/50">
          {category.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors group/item"
                >
                  <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-primary/10 transition-colors">
                    <ItemIcon className="h-4 w-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover/item:text-primary group-hover/item:translate-x-0.5 transition-all" />
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
