import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { 
  BarChart3, 
  Brain, 
  FileText, 
  Target, 
  TrendingDown, 
  GraduationCap, 
  Gamepad2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    id: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard Estratégico com IA',
    description: 'Visualize MRR/ARR projetado, Run Rate vs Meta, LTV/CAC, e receba insights críticos automáticos com previsão trimestral.',
    highlights: ['MRR/ARR projetado', 'Forecast com confiança IA', 'Insights críticos automáticos', 'Tendência de vendas'],
    color: 'primary',
  },
  {
    id: 'pipeline',
    icon: Brain,
    title: 'Pipeline com IA',
    description: 'Score preditivo, probabilidade real de fechamento, insights automáticos em cada oportunidade e detecção de risco.',
    highlights: ['Score preditivo', 'Timeline inteligente', 'Detecção de risco', 'Contexto automático'],
    color: 'accent',
  },
  {
    id: 'proposals',
    icon: FileText,
    title: 'Proposal Analytics',
    description: 'Mapa de atenção, visualização em tempo real, engajamento da proposta com alertas de interesse e risco.',
    highlights: ['Mapa de atenção', 'Tempo médio de leitura', 'Alertas de interesse', 'Análise por dispositivo'],
    color: 'secondary',
  },
  {
    id: 'scoring',
    icon: Target,
    title: 'Lead & Opportunity Scoring',
    description: 'Segmentação automática A/B/C/D/F, recálculo via IA e top oportunidades por score com análise comportamental.',
    highlights: ['Segmentação A/B/C/D/F', 'Recalcular via IA', 'Top oportunidades', 'Análise profunda'],
    color: 'green',
  },
  {
    id: 'winloss',
    icon: TrendingDown,
    title: 'Win/Loss Hub',
    description: 'Principais motivos de perda, ciclo de venda médio, perdas por concorrente e análise IA orientada.',
    highlights: ['Motivos de perda', 'Ciclo de venda', 'Análise competitiva', 'Fatores de decisão'],
    color: 'orange',
  },
  {
    id: 'coach',
    icon: GraduationCap,
    title: 'Sales Coach IA',
    description: 'Treinos personalizados com IA, competências analisadas, ranking, missões e sugestões de melhoria.',
    highlights: ['Treinos com IA', 'Ranking de performance', 'Missões gamificadas', 'Coaching personalizado'],
    color: 'purple',
  },
  {
    id: 'roleplay',
    icon: Gamepad2,
    title: 'Roleplay com IA',
    description: 'Treinamento realista com simulações em diferentes perfis de clientes para aperfeiçoar técnicas de vendas.',
    highlights: ['Simulações realistas', 'Múltiplos perfis', 'Feedback imediato', 'Evolução contínua'],
    color: 'pink',
  },
];

const colorClasses = {
  primary: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    glow: 'group-hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]',
  },
  accent: {
    bg: 'bg-accent/10',
    border: 'border-accent/30',
    text: 'text-accent',
    glow: 'group-hover:shadow-[0_0_30px_-5px_hsl(var(--accent)/0.3)]',
  },
  secondary: {
    bg: 'bg-secondary/10',
    border: 'border-secondary/30',
    text: 'text-secondary',
    glow: 'group-hover:shadow-[0_0_30px_-5px_hsl(var(--secondary)/0.3)]',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-500',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-500',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)]',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-500',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-500',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.3)]',
  },
};

export function FeaturesShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  return (
    <section id="funcionalidades" className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Sparkles className="w-4 h-4" />
            Funcionalidades Poderosas
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            O que o <span className="text-gradient-primary">NOID</span> faz por você
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Cada funcionalidade foi projetada para eliminar trabalho manual e amplificar a inteligência do seu time comercial.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colors = colorClasses[feature.color as keyof typeof colorClasses];
            const isActive = activeFeature === feature.id;

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="group"
                onMouseEnter={() => setActiveFeature(feature.id)}
                onMouseLeave={() => setActiveFeature(null)}
              >
                <div className={cn(
                  "relative h-full p-6 rounded-2xl bg-card border transition-all duration-300",
                  "hover:border-primary/30 hover-lift",
                  colors.glow
                )}>
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                    colors.bg
                  )}>
                    <Icon className={cn("w-6 h-6", colors.text)} />
                  </div>

                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="space-y-2">
                    {feature.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <ChevronRight className={cn("w-3 h-3", colors.text)} />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>

                  {/* Hover overlay */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                    `bg-gradient-to-br from-transparent via-transparent to-${feature.color === 'primary' ? 'primary' : feature.color === 'accent' ? 'accent' : feature.color === 'secondary' ? 'secondary' : feature.color + '-500'}/5`
                  )} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
