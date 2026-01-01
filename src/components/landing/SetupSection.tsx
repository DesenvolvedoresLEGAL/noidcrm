import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Building2, Check, ArrowRight } from 'lucide-react';

const setups = [
  {
    name: 'Setup Neural',
    price: 'R$ 5.000',
    hours: '10 horas',
    icon: Rocket,
    description: 'Implementação padrão para times que querem começar rápido.',
    features: [
      'Configuração completa do NOID',
      'Migração de dados do CRM atual',
      'Integração com ferramentas essenciais',
      'Treinamento da equipe',
      'Suporte por 30 dias',
    ],
    cta: 'Solicitar Setup Neural',
    popular: false,
  },
  {
    name: 'Setup Autonomous',
    price: 'R$ 18.000',
    hours: '24 horas',
    icon: Building2,
    description: 'Implementação enterprise com customizações avançadas.',
    features: [
      'Tudo do Setup Neural',
      'Playbooks customizados para seu negócio',
      'Configuração de automações avançadas',
      'Integração com APIs proprietárias',
      'Consultoria de processos',
      'Suporte prioritário por 90 dias',
    ],
    cta: 'Falar com Especialista',
    popular: true,
  },
];

export function SetupSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="setup" className="py-24 bg-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Rocket className="w-4 h-4" />
            Implantação
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Setups de <span className="text-gradient-primary">Implementação</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Escolha o pacote ideal para começar sua jornada com o NOID.
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted/50 border border-border/50">
            <p className="text-sm text-foreground/80">
              Setups são serviços <span className="font-medium text-primary">opcionais</span> de implantação.
              <br className="hidden sm:block" />
              <span className="text-muted-foreground">Você pode usar o NOID de forma autônoma ou contratar nosso time para acelerar a implementação.</span>
            </p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {setups.map((setup, index) => {
            const Icon = setup.icon;
            return (
              <motion.div
                key={setup.name}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative p-8 rounded-2xl bg-card border ${
                  setup.popular ? 'border-primary shadow-glow' : 'border-border'
                }`}
              >
                {setup.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      Recomendado
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    setup.popular ? 'bg-primary' : 'bg-muted'
                  }`}>
                    <Icon className={`w-7 h-7 ${setup.popular ? 'text-primary-foreground' : 'text-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{setup.name}</h3>
                    <p className="text-sm text-muted-foreground">{setup.hours} de consultoria</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">{setup.price}</span>
                  <span className="text-muted-foreground ml-2">único</span>
                </div>

                <p className="text-muted-foreground mb-6">{setup.description}</p>

                <ul className="space-y-3 mb-8">
                  {setup.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className={`w-full text-lg py-6 group ${
                    setup.popular
                      ? 'bg-primary hover:bg-primary/90 glow-primary'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  {setup.cta}
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  {setup.popular
                    ? "Avaliação de escopo antes da contratação."
                    : "Fala direta com o time de implantação."}
                </p>
              </motion.div>
            );
          })}
        </div>
        
        {/* Final Conceptual Microcopy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <div className="inline-flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-card border border-border/50">
            <p className="text-sm text-foreground/80">
              <span className="font-medium">Plano</span> define o poder da IA.
            </p>
            <p className="text-sm text-foreground/80">
              <span className="font-medium">Setup</span> define a velocidade da implantação.
            </p>
            <p className="text-sm text-primary font-medium mt-1">
              Você escolhe quando e como evoluir.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
