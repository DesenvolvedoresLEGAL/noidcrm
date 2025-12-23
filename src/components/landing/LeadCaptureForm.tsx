import { useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Rocket, Shield, Zap, ArrowRight } from "lucide-react";

// HUMANOID organization receives all landing page leads
const HUMANOID_ORG_ID = "774d7d78-8257-4891-aac7-718039b80049";

const segments = [
  "Tecnologia / SaaS",
  "Serviços Profissionais",
  "Indústria / Manufatura",
  "Varejo / E-commerce",
  "Saúde",
  "Educação",
  "Financeiro",
  "Imobiliário",
  "Outro",
];

const teamSizes = ["1-3 vendedores", "4-10 vendedores", "11-30 vendedores", "31-50 vendedores", "50+ vendedores"];

interface FormData {
  nome: string;
  email: string;
  empresa: string;
  telefone: string;
  segmento: string;
  tamanho_time: string;
}

export function LeadCaptureForm() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    empresa: "",
    telefone: "",
    segmento: "",
    tamanho_time: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.email || !formData.empresa) {
      toast.error("Por favor, preencha os campos obrigatórios.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ingest-lead", {
        body: {
          lead: {
            razao_social: formData.empresa,
            contact_nome: formData.nome,
            contact_email: formData.email,
            contact_telefone: formData.telefone || null,
            segmento: formData.segmento || null,
            porte: formData.tamanho_time || null,
            origem: "landing_page_noid",
          },
          organization_id: HUMANOID_ORG_ID,
        },
      });

      if (error) throw error;

      toast.success("Inscrição realizada com sucesso! Entraremos em contato em breve.");

      // Reset form
      setFormData({
        nome: "",
        email: "",
        empresa: "",
        telefone: "",
        segmento: "",
        tamanho_time: "",
      });
    } catch (error) {
      console.error("Error submitting lead:", error);
      toast.error("Erro ao enviar. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="criar-conta" className="py-24 bg-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
              <Rocket className="w-4 h-4" />
              Comece Agora
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Transforme suas vendas com <span className="text-gradient-primary">inteligência artificial</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Preencha o formulário e nossa equipe entrará em contato para agendar sua demonstração personalizada.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Implementação Rápida</p>
                  <p className="text-sm text-muted-foreground">Setup completo com migração de dados</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">30 dias grátis</p>
                  <p className="text-sm text-muted-foreground">Sem cartão de crédito</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-card border border-border shadow-card">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input
                      id="nome"
                      placeholder="Seu nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      placeholder="(11) 99999-9999"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email corporativo *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@empresa.com.br"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa *</Label>
                  <Input
                    id="empresa"
                    placeholder="Nome da sua empresa"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select
                      value={formData.segmento}
                      onValueChange={(value) => setFormData({ ...formData, segmento: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((segment) => (
                          <SelectItem key={segment} value={segment}>
                            {segment}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho do time</Label>
                    <Select
                      value={formData.tamanho_time}
                      onValueChange={(value) => setFormData({ ...formData, tamanho_time: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="w-full text-lg py-6 bg-primary hover:bg-primary/90 glow-primary group"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Começar Minha Revolução em Vendas
                      <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao enviar, você concorda com nossa{" "}
                  <a href="#" className="underline hover:text-foreground">
                    Política de Privacidade
                  </a>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
