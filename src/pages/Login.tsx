import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, Mail, Zap } from 'lucide-react';
import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel';
import { getLoginErrorDescription, logAuthConfigCheck, logAuthLoginError } from '@/lib/authDiagnostics';

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

const inputVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.1 + i * 0.1, duration: 0.4 },
  }),
};

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    logAuthConfigCheck();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        logAuthLoginError(error);
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Credenciais inválidas',
            description: getLoginErrorDescription(error),
            variant: 'destructive',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            title: 'Email não confirmado',
            description: getLoginErrorDescription(error),
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        // AUTH.1.3: limpa cache de qualquer sessão anterior antes de navegar.
        // Garante que queries privadas com organizationId antigo não disparem.
        queryClient.clear();
        await new Promise(resolve => setTimeout(resolve, 100));

        toast({
          title: t('loginSuccess', { ns: 'auth' }),
          description: t('welcome', { ns: 'dashboard' }),
        });
        navigate('/app/dashboard');
      }
    } catch (error: any) {
      logAuthLoginError(error);
      toast({
        title: t('loginError', { ns: 'auth' }),
        description: getLoginErrorDescription(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('login', { ns: 'auth' })} - {t('appName')}</title>
        <meta name="description" content="Faça login no NOID CRM - Sistema de inteligência de receita que identifica vazamentos comerciais" />
      </Helmet>
      
      <div className="min-h-screen flex">
        {/* Left Panel - Hero Visual */}
        <AuthHeroPanel />

        {/* Right Panel - Login Form */}
        <main className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-b from-background to-muted/30">
          {/* Mobile Logo */}
          <div className="lg:hidden absolute top-6 left-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">NOID</span>
            </div>
          </div>

          <motion.div
            className="w-full max-w-md"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Card com Glassmorphism */}
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-xl opacity-50" />
              
              <div className="relative backdrop-blur-xl bg-card/80 border border-border/50 rounded-2xl shadow-2xl p-8 lg:p-10">
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.h1
                    className="text-2xl lg:text-3xl font-bold mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Bem-vindo de volta
                  </motion.h1>
                  <motion.p
                    className="text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Acesse sua central de inteligência de receita
                  </motion.p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5" aria-label="Formulário de login">
                  <motion.div
                    className="space-y-2"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                  >
                    <Label htmlFor="email" className="text-sm font-medium">
                      {t('email', { ns: 'auth' })}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="h-12 pl-11 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                        autoComplete="email"
                        aria-describedby="email-hint"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                  >
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium">
                        {t('password', { ns: 'auth' })}
                      </Label>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
                        onClick={() => navigate('/forgot-password')}
                        type="button"
                      >
                        {t('forgotPassword', { ns: 'auth' })}
                      </Button>
                    </div>
                    <PasswordInput
                      id="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                      autoComplete="current-password"
                    />
                  </motion.div>

                  <motion.div
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={2}
                  >
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/25"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/80 px-4 text-muted-foreground">
                      Novo por aqui?
                    </span>
                  </div>
                </div>

                {/* Sign Up Link */}
                <motion.div
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-12 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => navigate('/signup')}
                  >
                    Criar conta gratuita
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Footer */}
            <motion.p
              className="text-center text-xs text-muted-foreground mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Ao continuar, você concorda com nossos{' '}
              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate('/terms')}>
                Termos de Uso
              </Button>
              {' '}e{' '}
              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate('/privacy')}>
                Política de Privacidade
              </Button>
            </motion.p>
          </motion.div>
        </main>
      </div>
    </>
  );
}
