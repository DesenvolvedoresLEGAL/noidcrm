import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, addDays, startOfDay, setHours, setMinutes, isBefore, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  CalendarCheck, 
  Clock, 
  Video, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles,
  Users,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

const benefits = [
  { icon: Sparkles, text: "Demonstração personalizada do NOID RevenueOS" },
  { icon: Target, text: "Análise do seu cenário atual de vendas" },
  { icon: Users, text: "Tire dúvidas diretamente com especialistas" },
  { icon: Zap, text: "Veja a IA Autônoma em ação" },
];

export default function ScheduleDemo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const source = searchParams.get("source") || "landing";
  const score = searchParams.get("score");
  const classification = searchParams.get("classification");
  const prefilledName = searchParams.get("name") || "";
  const prefilledEmail = searchParams.get("email") || "";
  const prefilledCompany = searchParams.get("company") || "";
  const prefilledWhatsapp = searchParams.get("whatsapp") || "";

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const [formData, setFormData] = useState({
    name: prefilledName,
    email: prefilledEmail,
    company: prefilledCompany,
    whatsapp: prefilledWhatsapp,
  });

  const minDate = addDays(new Date(), 1);
  const maxDate = addDays(new Date(), 30);

  const disabledDays = useMemo(() => {
    return { before: minDate, after: maxDate };
  }, []);

  const handleDateSelect = (date: Date | undefined) => {
    if (date && !isWeekend(date)) {
      setSelectedDate(date);
      setSelectedTime(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !formData.name || !formData.email) {
      toast({
        variant: "destructive",
        title: "Preencha todos os campos obrigatórios",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledDatetime = setMinutes(setHours(selectedDate, hours), minutes);

      const { error } = await supabase.functions.invoke("schedule-demo", {
        body: {
          participantName: formData.name,
          participantEmail: formData.email,
          participantWhatsapp: formData.whatsapp,
          participantCompany: formData.company,
          scheduledDatetime: scheduledDatetime.toISOString(),
          durationMinutes: 30,
          demoType: source === "diagnostic" ? "diagnostic_followup" : "general",
          source,
          diagnosticScore: score ? parseInt(score) : undefined,
          diagnosticClassification: classification,
        },
      });

      if (error) throw error;

      setIsConfirmed(true);
      toast({
        title: "Demo agendada com sucesso!",
        description: "Você receberá uma confirmação por e-mail.",
      });
    } catch (error) {
      console.error("Error scheduling demo:", error);
      toast({
        variant: "destructive",
        title: "Erro ao agendar",
        description: "Tente novamente ou entre em contato pelo WhatsApp.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Demo Agendada!</h1>
          <p className="text-muted-foreground mb-6">
            Sua demonstração está confirmada para{" "}
            <span className="font-medium text-foreground">
              {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
            </span>
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Enviamos os detalhes para <span className="font-medium">{formData.email}</span>
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao site
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold text-lg">NOID</span>
          </button>
          {score && (
            <Badge variant="secondary">
              Score do diagnóstico: {score}
            </Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Agende sua Demo Assistida
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Converse com um especialista e veja como o NOID pode transformar sua operação de vendas com IA autônoma.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-5 gap-8">
            {/* Left Column - Benefits */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="md:col-span-2 space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    O que esperar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <benefit.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{benefit.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="font-medium">Duração: 30 minutos</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Demo objetiva e focada nas suas necessidades específicas.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column - Calendar + Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="md:col-span-3"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5" />
                    Escolha data e horário
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Calendar */}
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => isWeekend(date) || isBefore(date, minDate)}
                      fromDate={minDate}
                      toDate={maxDate}
                      locale={ptBR}
                      className="rounded-md border"
                    />
                  </div>

                  {/* Time Slots */}
                  {selectedDate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <Label className="mb-3 block">Horários disponíveis</Label>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {timeSlots.map((time) => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "text-sm",
                              selectedTime === time && "ring-2 ring-primary ring-offset-2"
                            )}
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Contact Form */}
                  {selectedTime && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4 pt-4 border-t"
                    >
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Seu nome"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="seu@email.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="company">Empresa</Label>
                          <Input
                            id="company"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="Nome da empresa"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="whatsapp">WhatsApp</Label>
                          <Input
                            id="whatsapp"
                            value={formData.whatsapp}
                            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>

                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="w-full"
                        size="lg"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Agendando...
                          </>
                        ) : (
                          <>
                            <CalendarCheck className="w-4 h-4 mr-2" />
                            Confirmar Agendamento
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        Você receberá uma confirmação por e-mail com o link da reunião.
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
