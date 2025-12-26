import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "O que é um RevenueOS?",
    answer:
      "RevenueOS (Sistema Operacional de Receita) é uma nova categoria de software que vai além do CRM tradicional. Enquanto CRMs são repositórios de dados, o RevenueOS é uma plataforma inteligente que pensa, analisa, prioriza e executa ações junto com seu time de vendas, automatizando até 70% do trabalho manual.",
  },
  {
    question: "Como o NOID reduz 70% do trabalho manual?",
    answer:
      "O NOID automatiza tarefas repetitivas como logging de atividades, follow-ups, atualização de pipeline, criação de relatórios e qualificação de leads. A IA copiloto analisa contexto, sugere próximas ações e executa workflows automaticamente, liberando seu time para focar em vendas.",
  },
  {
    question: "O NOID substitui meu CRM atual?",
    answer:
      "Sim. O NOID é uma solução completa que substitui CRMs tradicionais como Pipedrive, RD Station e HubSpot Starter, oferecendo todas as funcionalidades deles mais inteligência artificial nativa. Oferecemos migração assistida para garantir uma transição suave.",
  },
  {
    question: "Quanto tempo leva para implementar?",
    answer:
      "A implementação Neural leva apenas 10 horas. Inclui configuração completa do sistema, migração de dados, integração com suas ferramentas atuais e treinamento do time. Você pode começar a usar o NOID no mesmo dia.",
  },
  {
    question: "Funciona para times pequenos?",
    answer:
      "Absolutamente! O NOID foi projetado para escalar de 1 a 100+ vendedores. Para times pequenos, a IA compensa a falta de mão-de-obra automatizando processos. Para times grandes, oferece gestão avançada, hierarquias e analytics por equipe.",
  },
  {
    question: "A IA é realmente precisa nas previsões?",
    answer:
      "Sim. Nossa IA utiliza múltiplos algoritmos de machine learning treinados com dados reais de vendas B2B brasileiras. O forecast inclui grau de confiança e cenários (pessimista, realista, otimista), permitindo decisões baseadas em dados, não em intuição.",
  },
  {
    question: "Posso integrar com outras ferramentas?",
    answer:
      "Sim. O NOID oferece integrações nativas com WhatsApp, Google Calendar, Gmail e principais ferramentas de vendas. Também disponibilizamos API completa para integrações customizadas com seu stack tecnológico.",
  },
  {
    question: "Como funciona o período de teste?",
    answer:
      "Você tem 14 dias grátis com acesso completo a todas as funcionalidades, sem limitações. Não pedimos cartão de crédito antecipadamente. Se decidir continuar, ativamos a cobrança após o período de teste.",
  },
];

export function FAQSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <HelpCircle className="w-4 h-4" />
            Perguntas Frequentes
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Ainda tem <span className="text-gradient-primary">dúvidas</span>?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Respondemos as perguntas mais comuns sobre o NOID RevenueOS.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={faq.question}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className={cn(
                    "w-full text-left p-5 rounded-xl border transition-all duration-300",
                    openIndex === index
                      ? "bg-card border-primary/30"
                      : "bg-card/50 border-border hover:border-primary/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-base">{faq.question}</h3>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-muted-foreground transition-transform duration-300 flex-shrink-0",
                        openIndex === index && "rotate-180",
                      )}
                    />
                  </div>
                  <motion.div
                    initial={false}
                    animate={{
                      height: openIndex === index ? "auto" : 0,
                      opacity: openIndex === index ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="text-muted-foreground text-sm mt-4 leading-relaxed">{faq.answer}</p>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Schema.org FAQ structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            }),
          }}
        />
      </div>
    </section>
  );
}
