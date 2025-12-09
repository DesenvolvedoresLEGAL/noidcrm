import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Brain, RefreshCw, LineChart, Workflow } from 'lucide-react';

const pillars = [
  {
    icon: Brain,
    title: 'IA Copiloto nas Decisões',
    description: 'Traz insights críticos, alerta riscos, recomenda ações e previne perdas antes que aconteçam.',
    gradient: 'from-primary/20 to-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    icon: RefreshCw,
    title: 'Pipeline Vivo',
    description: 'Atualiza sozinho conforme comportamento, histórico, movimentações e engajamento do cliente.',
    gradient: 'from-accent/20 to-accent/5',
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
  },
  {
    icon: LineChart,
    title: 'Inteligência Preditiva Real',
    description: 'Forecast com confiança, scoring preditivo, previsão de receita e análise semântica de conversas.',
    gradient: 'from-secondary/20 to-secondary/5',
    iconBg: 'bg-secondary/10',
    iconColor: 'text-secondary',
  },
  {
    icon: Workflow,
    title: 'Operação Guiada por IA',
    description: 'Do treino ao atendimento, do pipeline ao BI, tudo é orientado por inteligência artificial.',
    gradient: 'from-green-500/20 to-green-500/5',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
  },
];

export function ValuePillarsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="produto" className="py-24 bg-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-sm font-medium text-primary mb-4">
            Os 4 Pilares do NOID RevenueOS
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Seu time comercial com{' '}
            <span className="text-gradient-primary">superpoderes</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Não é só um CRM. É um sistema operacional de receita que pensa, analisa e age junto com você.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className={`relative h-full p-6 rounded-2xl bg-gradient-to-br ${pillar.gradient} border border-border/50 hover:border-primary/30 transition-all duration-300 hover-lift`}>
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary/5 to-transparent" />
                  
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-xl ${pillar.iconBg} flex items-center justify-center mb-5`}>
                      <Icon className={`w-7 h-7 ${pillar.iconColor}`} />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{pillar.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
