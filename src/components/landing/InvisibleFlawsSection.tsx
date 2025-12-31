import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserX, Clock, Database, Lightbulb, Bot, ArrowDown } from 'lucide-react';

const flaws = [
  {
    icon: UserX,
    text: 'Leads bons sendo ignorados',
  },
  {
    icon: Clock,
    text: 'Follow ups esquecidos',
  },
  {
    icon: AlertTriangle,
    text: 'Vendedores ocupados demais para vender',
  },
  {
    icon: Database,
    text: 'CRM cheio de dados que ninguém usa',
  },
  {
    icon: Lightbulb,
    text: 'Decisões no feeling',
  },
  {
    icon: Bot,
    text: 'IA que promete muito e não explica nada',
  },
];

export function InvisibleFlawsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="falhas" className="py-24 bg-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-destructive mb-4">
            <AlertTriangle className="w-4 h-4" />
            O Problema Real
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Antes de falar em crescimento,
            <br />
            <span className="text-destructive">vamos falar do que destrói vendas.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12"
        >
          {flaws.map((flaw, index) => {
            const Icon = flaw.icon;
            return (
              <motion.div
                key={flaw.text}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border hover:border-destructive/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-destructive" />
                </div>
                <p className="font-medium text-foreground">{flaw.text}</p>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Esses erros não aparecem nos relatórios.
            <br />
            <span className="text-foreground font-semibold">Mas aparecem no faturamento.</span>
          </p>

          <Button
            size="lg"
            variant="outline"
            onClick={() => scrollToSection('#o-que-e-noid')}
            className="text-lg px-8 py-6 group"
          >
            Quero entender onde estou errando
            <ArrowDown className="w-5 h-5 ml-2 transition-transform group-hover:translate-y-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
