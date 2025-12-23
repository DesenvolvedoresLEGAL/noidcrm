import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, 
  AlertTriangle, 
  Zap, 
  Calendar,
  ArrowRight,
  Phone,
  Mail,
  Clock,
  Shield,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TrialBlockedOverlay() {
  const navigate = useNavigate();
  const { gracePeriodEndsAt, dataDeletionAt, isBlocked, isExpired } = useTrialStatus();

  if (!isBlocked && !isExpired) return null;

  const graceDaysRemaining = gracePeriodEndsAt 
    ? Math.max(0, differenceInDays(new Date(gracePeriodEndsAt), new Date()))
    : 0;

  const deletionDate = dataDeletionAt 
    ? format(new Date(dataDeletionAt), "dd 'de' MMMM", { locale: ptBR })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-destructive/50 shadow-2xl">
            <CardContent className="pt-8 pb-8 px-8">
              {/* Icon & Status */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4"
                >
                  <Lock className="w-10 h-10 text-destructive" />
                </motion.div>
                
                <Badge variant="destructive" className="mb-4 px-4 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Período de Teste Encerrado
                </Badge>

                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  Sua conta foi bloqueada
                </h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Seu período de teste de 14 dias chegou ao fim. 
                  Para continuar usando o NOID, faça o upgrade agora.
                </p>
              </div>

              {/* Grace Period Warning */}
              {graceDaysRemaining > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        Período de Graça: {graceDaysRemaining} dias restantes
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Seus dados estão seguros por mais {graceDaysRemaining} dias. 
                        Após esse período, eles serão programados para exclusão.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Data Deletion Warning */}
              {deletionDate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6"
                >
                  <div className="flex items-start gap-3">
                    <Trash2 className="w-5 h-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">
                        Exclusão de Dados: {deletionDate}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Todos os seus dados, leads, oportunidades e histórico serão 
                        permanentemente excluídos nesta data.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* What you'll lose */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  O que você não consegue mais acessar:
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    'Dashboard e relatórios',
                    'Pipeline de vendas',
                    'Leads e contatos',
                    'Propostas e contratos',
                    'Insights de IA',
                    'Gamificação e rankings',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 text-destructive" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg gap-2"
                  onClick={() => navigate('/app/settings/billing')}
                >
                  <Zap className="w-5 h-5" />
                  Fazer Upgrade Agora
                  <ArrowRight className="w-5 h-5" />
                </Button>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1 gap-2"
                    onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
                  >
                    <Phone className="w-4 h-4" />
                    Falar com Vendas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1 gap-2"
                    onClick={() => window.open('mailto:suporte@noid.com.br', '_blank')}
                  >
                    <Mail className="w-4 h-4" />
                    Suporte
                  </Button>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-6 pt-6 border-t border-border flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Dados criptografados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
