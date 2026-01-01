import { useRef } from "react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react";
import { PricingCard } from "./PricingCard";
import { PricingComparisonTable } from "./PricingComparisonTable";

const neuralFeatures = [
  "CRM completo (leads, contatos, deals e pipelines)",
  "IA copiloto em todo o sistema",
  "Geração de e-mails, follow-ups e notas",
  "Lead e Opportunity Scoring com IA",
  "Insights inteligentes de pipeline",
  "Relatórios com IA",
  "Micro-learning e coaching",
  "Gamificação nativa",
  "Higiene e alertas inteligentes de CRM",
];

const neuralExclusions = [
  "Agentes autônomos",
  "Execução automática de tarefas",
  "Ações sem validação humana",
  "Consumo de VOLTS",
];

const neuralIdealFor = [
  "Times em transição para IA",
  "Gestores que querem controle total",
  "Empresas que querem inteligência sem automação total",
];

const autonomousFeatures = [
  "Criação e execução de agentes de IA",
  "Agentes por função (SDR, Closer, CS, RevOps, Coach, Auditor)",
  "Execução automática de tarefas",
  "Follow-ups autônomos",
  "Movimentação automática de pipeline",
  "Atualização de CRM sem ação humana",
  "Execução de fluxos inteligentes",
  "Relatórios proativos gerados por agentes",
  "Memory Engine: aprende com histórico para melhorar decisões",
];

const autonomousIdealFor = [
  "Times enxutos e orientados à performance",
  "Empresas que querem reduzir trabalho humano",
  "Operações que precisam escalar sem contratar",
];

export function PricingSection() {
  const ref = useRef(null);
  const navigate = useNavigate();
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="pricing" className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Gift className="w-4 h-4" />
            Planos NOID RevenueOS
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            AI CRM First.{" "}
            <span className="text-gradient-primary">
              Escolha como sua IA vai atuar.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Do copiloto inteligente à automação total. Escale sua operação de
            vendas com IA.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
          <PricingCard
            type="neural"
            price="199,90"
            features={neuralFeatures}
            exclusions={neuralExclusions}
            idealFor={neuralIdealFor}
            ctaText="Começar com Neural"
            onCta={() => navigate("/signup?plan=neural")}
            isInView={isInView}
            delay={0.2}
          />
          <PricingCard
            type="autonomous"
            isRecommended
            price="299,90"
            features={autonomousFeatures}
            idealFor={autonomousIdealFor}
            ctaText="Ativar Autonomous"
            onCta={() => navigate("/signup?plan=autonomous")}
            isInView={isInView}
            delay={0.3}
          />
        </div>

        {/* Comparison Table */}
        <PricingComparisonTable isInView={isInView} delay={0.5} />

        {/* Microcopy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted/50 border border-border/50">
            <ArrowRight className="w-4 h-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              Você pode começar no{" "}
              <span className="font-medium text-foreground">Neural</span> e
              evoluir para o{" "}
              <span className="font-medium text-primary">Autonomous</span> a
              qualquer momento.
              <span className="ml-1 text-foreground/60">
                Sem perder dados. Sem migração. Sem fricção.
              </span>
            </p>
          </div>
        </motion.div>

        {/* Trial info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-xs text-center text-muted-foreground mt-6"
        >
          14 dias grátis em qualquer plano • Cancele quando quiser
        </motion.p>
      </div>
    </section>
  );
}
