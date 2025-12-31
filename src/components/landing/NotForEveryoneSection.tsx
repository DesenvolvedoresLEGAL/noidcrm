import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Ban, XCircle, ArrowRight } from 'lucide-react';

const exclusions = [
  'Empresas sem processo mínimo',
  'Times que odeiam dados',
  'Negócios sem follow up',
  'Quem busca IA mágica sem responsabilidade',
];

export function NotForEveryoneSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24 bg-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
            <Ban className="w-4 h-4" />
            Transparência Total
          </span>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12">
            O NOID não é para todo mundo.
            <br />
            <span className="text-muted-foreground">E isso é proposital.</span>
          </h2>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid sm:grid-cols-2 gap-4 mb-12 max-w-2xl mx-auto"
          >
            {exclusions.map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
              >
                <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{item}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="p-8 rounded-2xl bg-primary/5 border border-primary/20 mb-10 max-w-2xl mx-auto"
          >
            <p className="text-lg md:text-xl text-foreground">
              Se você quer evitar erros caros antes que eles apareçam,
              <br />
              <span className="text-primary font-semibold">o NOID foi feito para você.</span>
            </p>
          </motion.div>

          <Button
            size="lg"
            onClick={() => scrollToSection('#diagnostico')}
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 glow-primary group"
          >
            Descobrir se o NOID é para mim
            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
