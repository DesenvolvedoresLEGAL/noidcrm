import { useRef } from "react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Zap, Gift, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const features = [
  "Acesso completo a todas as funcionalidades",
  "IA Copiloto ilimitada",
  "Dashboards inteligentes",
  "Pipeline com automação",
  "Proposal Analytics",
  "Lead & Opportunity Scoring",
  "Win/Loss Hub automatizado",
  "Sales Coach IA",
  "Roleplay com IA",
  "Integrações nativas",
  "Suporte prioritário",
  "API completa",
];

export function PricingSection() {
  const ref = useRef(null);
  const navigate = useNavigate();
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const { data: organizationCount } = useQuery({
    queryKey: ["organization-count-landing"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-organization-count");
        if (error) return 0;
        return data?.count || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 60000,
    retry: false,
    staleTime: 30000,
  });

  const spotsLeft = Math.max(0, 100 - (organizationCount || 0));

  return (
    <section id="pricing" className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <Gift className="w-4 h-4" />
            Oferta de Lançamento
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Preço <span className="text-gradient-primary">promocional</span> para as
            <br className="hidden sm:block" /> primeiras 100 contas
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Garanta agora o melhor preço e comece a transformar suas vendas com IA.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-lg mx-auto"
        >
          <div className="relative rounded-3xl border-2 border-primary/50 bg-card overflow-hidden glow-primary">
            {/* Urgency Badge */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-accent py-2 px-4 text-center">
              <span className="text-sm font-semibold text-white flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                Apenas {spotsLeft} vagas restantes!
              </span>
            </div>

            <div className="p-8 pt-16">
              {/* Setup */}
              <div className="mb-6 pb-6 border-b border-border">
                <p className="text-sm text-muted-foreground mb-2">Setup Premium (10h de implantação)</p>
                <p className="text-3xl font-bold">R$ 5.000</p>
              </div>

              {/* Pricing */}
              <div className="mb-8">
                <p className="text-sm text-muted-foreground mb-2">Plano Neural</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-gradient-primary">R$ 199,90</span>
                  <span className="text-muted-foreground">/usuário/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="line-through">R$ 299,90</span>
                  <span className="ml-2 text-green-500 font-medium">Economize 33%</span>
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.03 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-500" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <Button
                size="lg"
                onClick={() => navigate("/signup")}
                className="w-full text-lg py-6 bg-primary hover:bg-primary/90 glow-primary group"
              >
                Garantir Preço Promocional
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                30 dias grátis • Cancele quando quiser • Sem taxas ocultas
              </p>
            </div>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Após o período promocional, o valor será de{" "}
            <span className="font-medium text-foreground">R$ 299,90/usuário/mês</span>.
            <br />
            Mantenha o preço promocional enquanto sua conta estiver ativa.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
