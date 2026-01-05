import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { FloatingMetrics } from './FloatingMetrics';

interface AuthHeroPanelProps {
  headline?: string;
  subheadline?: string;
}

export function AuthHeroPanel({
  headline = 'Descubra onde sua receita está vazando',
  subheadline = 'O único sistema que identifica falhas invisíveis antes que custem caro',
}: AuthHeroPanelProps) {
  return (
    <motion.aside
      className="hidden lg:flex lg:w-[45%] relative overflow-hidden"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Gradient Background Animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900" />
      
      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Radial Glow */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent opacity-60" />
      
      {/* Accent Glow Spots */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-accent/10 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-primary/20 blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Floating Metrics */}
      <FloatingMetrics />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-12 py-16">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-3 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <span className="text-3xl font-bold text-white">NOID</span>
        </motion.div>
        
        {/* Headlines */}
        <motion.div
          className="space-y-6 max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            {headline}
          </h1>
          <p className="text-lg text-white/70 leading-relaxed">
            {subheadline}
          </p>
        </motion.div>
        
        {/* Bottom Stats */}
        <motion.div
          className="mt-auto pt-12 flex gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div>
            <p className="text-3xl font-bold text-white">500+</p>
            <p className="text-sm text-white/50">Empresas ativas</p>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <p className="text-3xl font-bold text-white">R$ 1.2B</p>
            <p className="text-sm text-white/50">Em pipeline gerenciado</p>
          </div>
        </motion.div>
      </div>
    </motion.aside>
  );
}
