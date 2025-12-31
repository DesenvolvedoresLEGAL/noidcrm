import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Clock, Brain, Target, ArrowRight } from 'lucide-react';

const stats = [
  {
    icon: Zap,
    value: 50000,
    suffix: '+',
    label: 'Automações executadas',
    color: 'text-primary',
  },
  {
    icon: Clock,
    value: 78,
    suffix: ' min',
    label: 'Economizados por dia/vendedor',
    color: 'text-accent',
  },
  {
    icon: Brain,
    value: 12000,
    suffix: '+',
    label: 'Insights gerados pela IA',
    color: 'text-secondary',
  },
  {
    icon: Target,
    value: 35,
    suffix: '%',
    label: 'Aumento médio em conversão',
    color: 'text-green-500',
  },
];

const testimonials = [
  {
    quote: 'Antes do NOID, perdíamos oportunidades boas por falta de follow up. Agora o sistema não deixa nada escapar.',
    author: 'Maria Silva',
    role: 'Head de Vendas',
    company: 'TechCorp Brasil',
    metric: '+45% em taxa de conversão',
  },
  {
    quote: 'O forecast da IA é absurdamente preciso. Nunca mais erramos a meta por falta de visibilidade.',
    author: 'João Santos',
    role: 'Diretor Comercial',
    company: 'Innovate Solutions',
    metric: '92% de precisão no forecast',
  },
  {
    quote: 'Reduzimos 65% do tempo gasto em tarefas manuais. Agora focamos só em vender.',
    author: 'Ana Costa',
    role: 'CEO',
    company: 'Growth Masters',
    metric: '78min economizados/dia',
  },
];

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const duration = 2000;
    const increment = value / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {displayValue.toLocaleString('pt-BR')}{suffix}
    </span>
  );
}

export function SocialProofSection() {
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
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-card border border-border mb-4">
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className={`text-3xl md:text-4xl font-bold mb-2 ${stat.color}`}>
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Resultados <span className="text-gradient-primary">reais</span> de quem usa
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors"
            >
              {/* Metric Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-medium mb-4">
                <Target className="w-4 h-4" />
                {testimonial.metric}
              </div>

              <p className="text-muted-foreground mb-6">"{testimonial.quote}"</p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-sm">{testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role} • {testimonial.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <Button
            size="lg"
            onClick={() => scrollToSection('#diagnostico')}
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 glow-primary group"
          >
            Quero esses resultados
            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
