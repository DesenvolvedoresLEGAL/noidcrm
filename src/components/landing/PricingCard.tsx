import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowRight, Bot, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  type: "neural" | "autonomous";
  isRecommended?: boolean;
  price: string;
  pricePerUser?: string;
  features: string[];
  exclusions?: string[];
  idealFor?: string[];
  ctaText: string;
  onCta: () => void;
  isInView?: boolean;
  delay?: number;
}

export function PricingCard({
  type,
  isRecommended = false,
  price,
  pricePerUser = "/usuário/mês",
  features,
  exclusions,
  idealFor,
  ctaText,
  onCta,
  isInView = true,
  delay = 0,
}: PricingCardProps) {
  const isNeural = type === "neural";
  const Icon = isNeural ? Brain : Bot;
  const iconEmoji = isNeural ? "🧠" : "🤖";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className={cn(
        "relative rounded-3xl border-2 bg-card overflow-hidden h-full flex flex-col",
        isRecommended
          ? "border-primary glow-primary"
          : "border-border/50 hover:border-primary/30 transition-colors"
      )}
    >
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-accent py-2.5 px-4 text-center">
          <span className="text-sm font-semibold text-white flex items-center justify-center gap-2">
            ⭐ Recomendado
          </span>
        </div>
      )}

      <div className={cn("p-8 flex flex-col flex-1", isRecommended && "pt-14")}>
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className={cn(
              "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 text-3xl",
              isNeural ? "bg-cyan-500/10" : "bg-primary/10"
            )}
          >
            {iconEmoji}
          </div>
          <h3 className="text-2xl font-bold mb-1 uppercase tracking-wide">
            {type === "neural" ? "Neural" : "Autonomous"}
          </h3>
          <div
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full",
              isNeural
                ? "bg-cyan-500/10 text-cyan-500"
                : "bg-primary/10 text-primary"
            )}
          >
            <Icon className="w-4 h-4" />
            {isNeural ? "IA Assistiva" : "IA Autônoma"}
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-muted-foreground mb-6">
          {isNeural
            ? "A IA pensa. Você executa."
            : "A IA executa. Você supervisiona."}
        </p>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={cn(
                "text-4xl md:text-5xl font-bold",
                isRecommended ? "text-gradient-primary" : ""
              )}
            >
              R$ {price}
            </span>
          </div>
          <span className="text-muted-foreground text-sm">{pricePerUser}</span>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-6 flex-1">
          {type === "autonomous" && (
            <p className="text-sm font-medium text-primary mb-2">
              Tudo do Neural, mais:
            </p>
          )}
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-green-500" />
              </div>
              <span className="text-sm text-foreground/80">{feature}</span>
            </div>
          ))}
        </div>

        {/* Exclusions */}
        {exclusions && exclusions.length > 0 && (
          <div className="space-y-2 mb-6 pb-6 border-b border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Não inclui:
            </p>
            {exclusions.map((exclusion, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {exclusion}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* VOLTS Badge for Autonomous */}
        {type === "autonomous" && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Consumo inteligente
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              VOLTS representam o consumo de IA por atividade executada. Você paga apenas pelo que a IA realmente faz.
            </p>
          </div>
        )}

        {/* Ideal For */}
        {idealFor && idealFor.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Ideal para:
            </p>
            <ul className="space-y-1">
              {idealFor.map((item, index) => (
                <li key={index} className="text-sm text-foreground/70">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <Button
          size="lg"
          onClick={onCta}
          variant={isRecommended ? "default" : "outline"}
          className={cn(
            "w-full text-lg py-6 group",
            isRecommended && "bg-primary hover:bg-primary/90 glow-primary"
          )}
        >
          {ctaText}
          <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
        
        {/* CTA Subtitle */}
        <p className="text-xs text-center text-muted-foreground mt-3">
          {isNeural
            ? "Inicia um trial gratuito de 14 dias."
            : "Ativa o plano ou agenda uma demo assistida."}
        </p>
        
        {/* CTA Microcopy */}
        <p className="text-xs text-center text-foreground/60 mt-2">
          {isNeural
            ? "Você pode usar o NOID sozinho ou adicionar um setup opcional depois."
            : "Sem migração. Sem perda de dados. Setup opcional, quando fizer sentido."}
        </p>
      </div>
    </motion.div>
  );
}
