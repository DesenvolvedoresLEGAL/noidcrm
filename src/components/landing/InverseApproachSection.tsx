import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle, Users, MessageSquare, Eye, ArrowDown, Check, X } from 'lucide-react';

const approaches = [
  {
    problem: 'Oportunidades esquecidas',
    solution: 'NOID alerta antes da perda',
    iconProblem: AlertCircle,
    iconSolution: Shield,
  },
  {
    problem: 'Leads mal priorizados',
    solution: 'NOID reorganiza com lógica clara',
    iconProblem: Users,
    iconSolution: Check,
  },
  {
    problem: 'Follow ups falhos',
    solution: 'NOID executa ou cobra',
    iconProblem: MessageSquare,
    iconSolution: Check,
  },
  {
    problem: 'Decisões no escuro',
    solution: 'NOID explica cada recomendação',
    iconProblem: Eye,
    iconSolution: Check,
  },
];

export function InverseApproachSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="como-funciona" className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Shield className="w-4 h-4" />
            Abordagem Inversa
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            O NOID começa evitando
            <br />
            <span className="text-gradient-primary">que tudo dê errado.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12"
        >
          {approaches.map((item, index) => (
            <motion.div
              key={item.problem}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Problem */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <X className="w-5 h-5 text-destructive" />
                    <span className="text-sm font-medium text-destructive uppercase tracking-wide">Problema</span>
                  </div>
                  <p className="text-foreground font-medium">{item.problem}</p>
                </div>
                
                {/* Divider */}
                <div className="w-px h-16 bg-border" />
                
                {/* Solution */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-green-500 uppercase tracking-wide">Solução</span>
                  </div>
                  <p className="text-foreground font-medium">{item.solution}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <Button
            size="lg"
            onClick={() => scrollToSection('#diagnostico')}
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 glow-primary group"
          >
            Quero evitar esses erros
            <ArrowDown className="w-5 h-5 ml-2 transition-transform group-hover:translate-y-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
