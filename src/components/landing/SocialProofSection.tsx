import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { Zap, Clock, Brain, Target } from 'lucide-react';

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
    quote: 'O NOID mudou completamente nossa operação de vendas. A IA realmente pensa junto com a gente.',
    author: 'Maria Silva',
    role: 'Head de Vendas',
    company: 'TechCorp Brasil',
  },
  {
    quote: 'Reduzimos 65% do tempo gasto em tarefas manuais. Agora focamos só em vender.',
    author: 'João Santos',
    role: 'Diretor Comercial',
    company: 'Innovate Solutions',
  },
  {
    quote: 'O forecast da IA é absurdamente preciso. Nunca mais erramos a meta por falta de visibilidade.',
    author: 'Ana Costa',
    role: 'CEO',
    company: 'Growth Masters',
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

  return (
    <section className="py-24 bg-muted/30" ref={ref}>
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
            O que dizem nossos <span className="text-gradient-primary">clientes</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors"
            >
              <div className="mb-4">
                {/* Stars */}
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-4 h-4 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>

              <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>

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
      </div>
    </section>
  );
}
