import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock, Eye, Settings, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Eye,
    title: 'Explica tudo',
    description: 'Cada recomendação vem com o raciocínio por trás.',
  },
  {
    icon: Settings,
    title: 'Regras claras',
    description: 'Você define os limites. A IA respeita.',
  },
  {
    icon: Lock,
    title: 'Controle total',
    description: 'Nada acontece sem sua aprovação quando configurado.',
  },
];

export function AIGovernanceSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
              <ShieldCheck className="w-4 h-4" />
              IA com Governança
            </span>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              IA não deveria assustar.
              <br />
              <span className="text-gradient-primary">Deveria aliviar.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-8">
              No NOID, a IA não decide sozinha.
              Ela explica, sugere e executa apenas com regras claras.
              <br /><br />
              <span className="text-foreground font-medium">Você mantém controle.</span>
              <br />
              <span className="text-foreground font-medium">A IA elimina erro operacional.</span>
            </p>

            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 group"
            >
              Ver como a IA opera com segurança
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>

          {/* Right Content - Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className="flex items-start gap-4 p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
