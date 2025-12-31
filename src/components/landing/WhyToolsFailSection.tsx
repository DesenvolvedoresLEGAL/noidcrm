import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Layers, ArrowDown } from 'lucide-react';

const limitations = [
  { label: 'CRMs', description: 'organizam dados.' },
  { label: 'Automações', description: 'executam tarefas.' },
  { label: 'Relatórios', description: 'mostram o passado.' },
];

export function WhyToolsFailSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Layers className="w-4 h-4" />
            A Verdade Sobre Ferramentas
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12">
            Ferramentas isoladas não evitam
            <br />
            <span className="text-gradient-primary">erros sistêmicos.</span>
          </h2>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-3 gap-6 mb-12"
          >
            {limitations.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="p-6 rounded-xl bg-card border border-border"
              >
                <span className="text-2xl font-bold text-foreground">{item.label}</span>
                <p className="text-muted-foreground mt-2">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-lg md:text-xl text-muted-foreground mb-8"
          >
            Nada disso impede que erros aconteçam todos os dias.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="p-8 rounded-2xl bg-primary/5 border border-primary/20 mb-10"
          >
            <p className="text-lg md:text-xl text-foreground font-medium">
              O NOID não é mais uma ferramenta.
              <br />
              <span className="text-primary">É o sistema que orquestra, valida e protege toda a operação de receita.</span>
            </p>
          </motion.div>

          <Button
            size="lg"
            onClick={() => scrollToSection('#o-que-e-noid')}
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 glow-primary group"
          >
            Ver como o NOID funciona
            <ArrowDown className="w-5 h-5 ml-2 transition-transform group-hover:translate-y-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
