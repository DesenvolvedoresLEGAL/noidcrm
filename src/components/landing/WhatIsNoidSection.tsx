import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Cpu, Play } from 'lucide-react';

export function WhatIsNoidSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="o-que-e-noid" className="py-24 bg-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary mb-8 glow-primary"
          >
            <Cpu className="w-10 h-10 text-primary-foreground" />
          </motion.div>

          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            O Produto
          </span>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8">
            NOID não é apenas um CRM.
            <br />
            <span className="text-gradient-primary">É um Sistema Operacional de Receita.</span>
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto"
          >
            Enquanto CRMs registram dados, o NOID interpreta, decide e age.
            <br />
            <span className="text-foreground font-medium">Pipeline, pessoas e IA funcionando como um sistema vivo.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              onClick={() => window.open('/demo', '_blank')}
              className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 glow-primary group"
            >
              <Play className="w-5 h-5 mr-2" />
              Ver o NOID em ação
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
