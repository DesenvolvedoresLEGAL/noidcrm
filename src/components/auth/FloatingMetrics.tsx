import { motion } from 'framer-motion';
import { TrendingUp, Target, AlertTriangle, DollarSign, Users, Zap } from 'lucide-react';

const metrics = [
  {
    icon: DollarSign,
    value: '+R$ 2.4M',
    label: 'recuperados',
    delay: 0,
    position: { top: '15%', left: '10%' },
  },
  {
    icon: TrendingUp,
    value: '89%',
    label: 'taxa de conversão',
    delay: 0.5,
    position: { top: '25%', right: '15%' },
  },
  {
    icon: AlertTriangle,
    value: '47',
    label: 'falhas detectadas',
    delay: 1,
    position: { bottom: '30%', left: '8%' },
  },
  {
    icon: Target,
    value: '156',
    label: 'deals acelerados',
    delay: 1.5,
    position: { bottom: '20%', right: '10%' },
  },
  {
    icon: Users,
    value: '+340',
    label: 'leads qualificados',
    delay: 2,
    position: { top: '50%', left: '5%' },
  },
  {
    icon: Zap,
    value: '12h',
    label: 'tempo médio p/ fechar',
    delay: 2.5,
    position: { top: '60%', right: '5%' },
  },
];

const floatVariants = {
  animate: (delay: number) => ({
    y: [0, -15, 0],
    opacity: [0.7, 1, 0.7],
    transition: {
      y: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut' as const,
        delay,
      },
      opacity: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut' as const,
        delay,
      },
    },
  }),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
      delayChildren: 0.5,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
};

export function FloatingMetrics() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={index}
            className="absolute"
            style={metric.position as React.CSSProperties}
            variants={itemVariants}
            custom={metric.delay}
            animate="animate"
          >
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
              variants={floatVariants}
              animate="animate"
              custom={metric.delay}
            >
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Icon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{metric.value}</p>
                <p className="text-xs text-white/60">{metric.label}</p>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
