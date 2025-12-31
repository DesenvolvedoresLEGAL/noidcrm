import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';

const comparisons = [
  {
    feature: 'Automação',
    traditional: 'Regras manuais',
    noid: 'IA copiloto real',
  },
  {
    feature: 'Forecast',
    traditional: 'Intuição do vendedor',
    noid: 'Algoritmo preditivo com confiança',
  },
  {
    feature: 'Pipeline',
    traditional: 'Usuário atualiza manualmente',
    noid: 'Sistema atualiza sozinho',
  },
  {
    feature: 'Propostas',
    traditional: 'Enviar e torcer',
    noid: 'Analytics + mapa de atenção',
  },
  {
    feature: 'Treinamento',
    traditional: 'PDFs e planilhas',
    noid: 'Roleplay com IA',
  },
  {
    feature: 'Desenvolvimento',
    traditional: 'Feedbacks manuais',
    noid: 'Coach IA personalizado',
  },
  {
    feature: 'Win/Loss',
    traditional: 'Baseado em intuição',
    noid: 'Auditoria automatizada',
  },
  {
    feature: 'Decisões',
    traditional: 'Baseadas em achismo',
    noid: 'IA + contexto real',
  },
];

export function ComparisonTable() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="diferencial" className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Sparkles className="w-4 h-4" />
            Diferenciação Absoluta
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Por que <span className="text-gradient-primary">NÃO</span> somos um CRM?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            CRMs tradicionais são repositórios de dados. O NOID é um sistema operacional que pensa e age.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-card">
            {/* Header */}
            <div className="grid grid-cols-3 bg-muted/50 border-b border-border">
              <div className="p-4 md:p-6 font-semibold text-sm md:text-base">
                Recurso
              </div>
              <div className="p-4 md:p-6 font-semibold text-sm md:text-base text-center border-l border-border">
                <span className="text-muted-foreground">CRMs Tradicionais</span>
              </div>
              <div className="p-4 md:p-6 font-semibold text-sm md:text-base text-center border-l border-border">
                <span className="text-gradient-primary">NOID RevenueOS</span>
              </div>
            </div>

            {/* Rows */}
            {comparisons.map((row, index) => (
              <motion.div
                key={row.feature}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                className={`grid grid-cols-3 ${index !== comparisons.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="p-4 md:p-5 text-sm md:text-base font-medium">
                  {row.feature}
                </div>
                <div className="p-4 md:p-5 text-sm md:text-base text-center border-l border-border">
                  <div className="flex items-center justify-center gap-2">
                    <X className="w-4 h-4 text-destructive flex-shrink-0" />
                    <span className="text-muted-foreground text-xs md:text-sm">{row.traditional}</span>
                  </div>
                </div>
                <div className="p-4 md:p-5 text-sm md:text-base text-center border-l border-border bg-primary/5">
                  <div className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-foreground font-medium text-xs md:text-sm">{row.noid}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 group"
          >
            Ver porque não somos um CRM tradicional
            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
