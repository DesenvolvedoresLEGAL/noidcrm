import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SupportOptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'warning' | 'success';
  disabled?: boolean;
  badge?: string;
  index?: number;
}

const variantStyles = {
  default: 'hover:border-primary/30 hover:bg-primary/5',
  primary: 'border-primary/20 bg-primary/5 hover:bg-primary/10',
  warning: 'border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10',
  success: 'border-green-500/20 bg-green-500/5 hover:bg-green-500/10',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-orange-500/10 text-orange-500',
  success: 'bg-green-500/10 text-green-500',
};

export function SupportOptionCard({
  icon: Icon,
  title,
  description,
  onClick,
  variant = 'default',
  disabled = false,
  badge,
  index = 0,
}: SupportOptionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      <Card
        className={cn(
          'cursor-pointer transition-all duration-200 border',
          variantStyles[variant],
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={disabled ? undefined : onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('p-3 rounded-xl', iconStyles[variant])}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{title}</h3>
                {badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
