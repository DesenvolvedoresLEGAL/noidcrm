import { motion } from 'framer-motion';
import { TrendingUp, Target, AlertTriangle, DollarSign, Users, Zap } from 'lucide-react';

const metrics = [
  {
    icon: DollarSign,
    value: '+R$ 2.4M',
    label: 'recuperados',
  },
  {
    icon: TrendingUp,
    value: '89%',
    label: 'taxa de conversão',
  },
  {
    icon: AlertTriangle,
    value: '47',
    label: 'falhas detectadas',
  },
  {
    icon: Target,
    value: '156',
    label: 'deals acelerados',
  },
  {
    icon: Users,
    value: '+340',
    label: 'leads qualificados',
  },
  {
    icon: Zap,
    value: '12h',
    label: 'tempo médio p/ fechar',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
};

const floatVariants = {
  animate: (delay: number) => ({
    y: [0, -8, 0],
    transition: {
      y: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut' as const,
        delay: delay * 0.2,
      },
    },
  }),
};

export function FloatingMetrics() {
  return (
    <motion.div
      className="w-full py-6 lg:py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Mobile: Horizontal scroll strip */}
      <div className="lg:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 w-max">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                custom={index}
              >
                <motion.div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg whitespace-nowrap"
                  variants={floatVariants}
                  animate="animate"
                  custom={index}
                >
                  <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{metric.value}</p>
                    <p className="text-[10px] text-white/60">{metric.label}</p>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Desktop: Grid layout in the empty space */}
      <div className="hidden lg:grid grid-cols-3 gap-3 xl:gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={index}
              variants={itemVariants}
              custom={index}
            >
              <motion.div
                className="flex items-center gap-2 px-3 py-2 xl:px-4 xl:py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
                variants={floatVariants}
                animate="animate"
                custom={index}
              >
                <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 xl:w-5 xl:h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm xl:text-base font-bold text-white">{metric.value}</p>
                  <p className="text-xs text-white/60">{metric.label}</p>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
