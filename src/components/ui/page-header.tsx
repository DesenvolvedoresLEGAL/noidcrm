import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const iconVariants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -180 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

const blurVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

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
    <motion.div 
      className={cn(
        "relative overflow-hidden rounded-xl border",
        "p-4 md:p-6", // Padding responsivo
        "bg-gradient-to-r",
        styles.gradient
      )}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Decoração blur animada */}
      <motion.div 
        className={cn(
          "absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2",
          styles.blur
        )}
        variants={blurVariants}
      />
      
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Ícone animado - responsivo */}
          <motion.div 
            className={cn(
              "h-10 w-10 md:h-14 md:w-14 rounded-xl flex items-center justify-center shrink-0",
              styles.iconBg
            )}
            variants={iconVariants}
          >
            <Icon className={cn("h-5 w-5 md:h-7 md:w-7", styles.iconColor)} />
          </motion.div>
          
          {/* Título e Subtítulo - responsivo */}
          <div className="min-w-0">
            <motion.h1 
              className="text-xl md:text-2xl font-bold flex items-center gap-2 flex-wrap"
              variants={itemVariants}
            >
              {title}
              {badge && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Badge variant="secondary" className={cn("ml-2", styles.badgeBg)}>
                    {badge.icon && <badge.icon className="h-3 w-3 mr-1" />}
                    {badge.label}
                  </Badge>
                </motion.span>
              )}
            </motion.h1>
            <motion.p 
              className="text-sm md:text-base text-muted-foreground truncate"
              variants={itemVariants}
            >
              {subtitle}
            </motion.p>
          </div>
        </div>
        
        {/* Ações animadas - responsivas */}
        {actions && (
          <motion.div 
            className="flex gap-2 flex-wrap w-full md:w-auto"
            variants={itemVariants}
          >
            {actions}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
