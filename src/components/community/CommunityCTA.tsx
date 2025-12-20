import { motion } from "framer-motion";
import { Rocket, Lightbulb, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CommunityCTAProps {
  onCreateSuggestion?: () => void;
  onStartDiscussion?: () => void;
}

export function CommunityCTA({ onCreateSuggestion, onStartDiscussion }: CommunityCTAProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative px-8 py-12 text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
            className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 border border-primary/20 mb-4"
          >
            <Rocket className="h-8 w-8 text-primary" />
          </motion.div>

          <h2 className="text-2xl font-bold text-foreground mb-2">
            Participe da construção do NOID RevenueOS
          </h2>
          
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Sua voz importa. Cada sugestão nos ajuda a evoluir e construir 
            o produto que transforma a forma como equipes de vendas trabalham.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="gap-2" onClick={onCreateSuggestion}>
              <Lightbulb className="h-5 w-5" />
              Criar minha primeira sugestão
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={onStartDiscussion}>
              <MessageSquare className="h-5 w-5" />
              Explorar discussões
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
