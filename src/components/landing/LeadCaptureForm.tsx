import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Shield, CheckCircle } from "lucide-react";
import { DiagnosticModal } from "@/components/diagnostic/DiagnosticModal";
import { z } from "zod";

// HUMANOID organization receives all landing page leads
const HUMANOID_ORG_ID = "774d7d78-8257-4891-aac7-718039b80049";

// Validation schema
const leadSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  empresa: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  whatsapp: z.string()
    .min(14, "WhatsApp inválido")
    .regex(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/, "WhatsApp inválido. Use o formato (11) 99999-9999"),
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
});

interface FormData {
  nome: string;
  empresa: string;
  whatsapp: string;
  email: string;
}

interface FormErrors {
  nome?: string;
  empresa?: string;
  whatsapp?: string;
  email?: string;
}

// Phone mask function
function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : "";
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

export function LeadCaptureForm() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isLoading, setIsLoading] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    empresa: "",
    whatsapp: "",
    email: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validate field on blur
  const validateField = (field: keyof FormData, value: string) => {
    try {
      leadSchema.shape[field].parse(value);
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: err.errors[0]?.message }));
      }
    }
  };

  const handleBlur = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const handleChange = (field: keyof FormData, value: string) => {
    const newValue = field === "whatsapp" ? formatPhone(value) : value;
    setFormData((prev) => ({ ...prev, [field]: newValue }));
    
    // Clear error when user starts typing
    if (touched[field]) {
      validateField(field, newValue);
    }
  };

  const isFormValid = () => {
    const result = leadSchema.safeParse(formData);
    return result.success;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const result = leadSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormErrors;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      setTouched({ nome: true, empresa: true, whatsapp: true, email: true });
      toast.error("Por favor, corrija os erros no formulário.");
      return;
    }

    setIsLoading(true);

    try {
      console.log("[LeadCaptureForm] Submitting lead:", { ...formData, email: formData.email.substring(0, 5) + "***" });
      
      const { data, error } = await supabase.functions.invoke("ingest-lead", {
        body: {
          lead: {
            razao_social: formData.empresa,
            contact_nome: formData.nome,
            contact_email: formData.email,
            contact_telefone: formData.whatsapp,
            origem: "landing_page_diagnostico",
          },
          organization_id: HUMANOID_ORG_ID,
        },
      });

      if (error) throw error;

      console.log("[LeadCaptureForm] Lead ingested successfully:", data);

      // Capture opportunity_id from response
      const oppId = data?.data?.opportunity_id || data?.opportunity_id;
      if (oppId) {
        console.log("[LeadCaptureForm] Captured opportunity_id:", oppId);
        setOpportunityId(oppId);
      } else {
        console.warn("[LeadCaptureForm] No opportunity_id returned from ingest-lead");
      }

      toast.success("Dados recebidos! Iniciando diagnóstico...");
      
      // Open diagnostic modal
      setShowDiagnostic(true);
    } catch (error) {
      console.error("[LeadCaptureForm] Error submitting lead:", error);
      toast.error("Erro ao enviar. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    "Identifique vazamentos de receita",
    "Descubra gargalos operacionais",
    "Receba recomendações personalizadas",
  ];

  return (
    <section id="diagnostico" className="py-24 bg-primary/5" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
              <Search className="w-4 h-4" />
              Diagnóstico Gratuito
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Descubra os <span className="text-gradient-primary">erros invisíveis</span>
              <br />
              da sua operação de vendas.
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Um diagnóstico rápido para identificar vazamentos de receita antes que eles custem caro.
            </p>

            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="font-medium">{benefit}</span>
                </motion.div>
              ))}
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
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Seu nome completo"
                    value={formData.nome}
                    onChange={(e) => handleChange("nome", e.target.value)}
                    onBlur={() => handleBlur("nome")}
                    maxLength={100}
                    className={`py-6 ${touched.nome && errors.nome ? "border-destructive" : ""}`}
                  />
                  {touched.nome && errors.nome && (
                    <p className="text-sm text-destructive">{errors.nome}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa *</Label>
                  <Input
                    id="empresa"
                    placeholder="Nome da sua empresa"
                    value={formData.empresa}
                    onChange={(e) => handleChange("empresa", e.target.value)}
                    onBlur={() => handleBlur("empresa")}
                    maxLength={100}
                    className={`py-6 ${touched.empresa && errors.empresa ? "border-destructive" : ""}`}
                  />
                  {touched.empresa && errors.empresa && (
                    <p className="text-sm text-destructive">{errors.empresa}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange("whatsapp", e.target.value)}
                    onBlur={() => handleBlur("whatsapp")}
                    maxLength={16}
                    className={`py-6 ${touched.whatsapp && errors.whatsapp ? "border-destructive" : ""}`}
                  />
                  {touched.whatsapp && errors.whatsapp && (
                    <p className="text-sm text-destructive">{errors.whatsapp}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@empresa.com.br"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    maxLength={255}
                    className={`py-6 ${touched.email && errors.email ? "border-destructive" : ""}`}
                  />
                  {touched.email && errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading || !isFormValid()}
                  className="w-full text-lg py-6 bg-primary hover:bg-primary/90 glow-primary"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Rodar diagnóstico gratuito
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-center text-foreground/70 mt-2">
                  Você recebe um score e recomendações imediatas.
                </p>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                  <Shield className="w-4 h-4" />
                  <span>Não vendemos seus dados. Sem spam.</span>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </div>

      <DiagnosticModal
        open={showDiagnostic}
        onOpenChange={setShowDiagnostic}
        leadData={formData}
        opportunityId={opportunityId}
      />
    </section>
  );
}
