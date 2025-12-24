import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: {
    label: string;
    icon?: LucideIcon;
  };
  actions?: React.ReactNode;
  variant?: 'primary' | 'emerald' | 'indigo' | 'amber' | 'teal' | 'purple' | 'rose';
}

const variantStyles = {
  primary: {
    gradient: 'from-primary/10 via-primary/5 to-transparent',
    blur: 'bg-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    badgeBg: 'bg-primary/10 text-primary',
  },
  emerald: {
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    blur: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-500/10 text-emerald-600',
  },
  indigo: {
    gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
    blur: 'bg-indigo-500/5',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-600',
    badgeBg: 'bg-indigo-500/10 text-indigo-600',
  },
  amber: {
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    blur: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-500/10 text-amber-600',
  },
  teal: {
    gradient: 'from-teal-500/10 via-teal-500/5 to-transparent',
    blur: 'bg-teal-500/5',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-600',
    badgeBg: 'bg-teal-500/10 text-teal-600',
  },
  purple: {
    gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    blur: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
    badgeBg: 'bg-purple-500/10 text-purple-600',
  },
  rose: {
    gradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    blur: 'bg-rose-500/5',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    badgeBg: 'bg-rose-500/10 text-rose-600',
  },
};

export function PageHeader({ 
  icon: Icon, 
  title, 
  subtitle, 
  badge, 
  actions, 
  variant = 'primary' 
}: PageHeaderProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-6 animate-fade-in",
      "bg-gradient-to-r",
      styles.gradient
    )}>
      {/* Decoração blur */}
      <div className={cn(
        "absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2",
        styles.blur
      )} />
      
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Ícone */}
          <div className={cn(
            "h-14 w-14 rounded-xl flex items-center justify-center shrink-0",
            styles.iconBg
          )}>
            <Icon className={cn("h-7 w-7", styles.iconColor)} />
          </div>
          
          {/* Título e Subtítulo */}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
              {title}
              {badge && (
                <Badge variant="secondary" className={cn("ml-2", styles.badgeBg)}>
                  {badge.icon && <badge.icon className="h-3 w-3 mr-1" />}
                  {badge.label}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        
        {/* Ações */}
        {actions && (
          <div className="flex gap-2 flex-wrap">{actions}</div>
        )}
      </div>
    </div>
  );
}
