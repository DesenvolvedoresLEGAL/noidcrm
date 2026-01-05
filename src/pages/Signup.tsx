import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, User, Zap } from 'lucide-react';
import { z } from 'zod';
import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel';

const signupSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter ao menos 1 letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter ao menos 1 número'),
  confirmPassword: z.string(),
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar os termos de uso e política de privacidade',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

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
    transition: { delay: 0.1 + i * 0.08, duration: 0.4 },
  }),
};

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = signupSchema.safeParse({ fullName, email, password, confirmPassword, acceptedTerms });
      
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: 'Erro de validação',
          description: firstError.message,
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await signUp(email, password, fullName);
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: 'Email já cadastrado',
            description: 'Este email já está em uso. Tente fazer login.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Redirecionando para configuração inicial...',
        });
        navigate('/onboarding');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Criar Conta - NOID CRM</title>
        <meta name="description" content="Crie sua conta gratuita no NOID CRM - Sistema de inteligência de receita" />
      </Helmet>

      <div className="min-h-screen flex">
        {/* Left Panel - Hero Visual */}
        <AuthHeroPanel
          headline="Transforme dados em decisões de receita"
          subheadline="Comece gratuitamente e descubra onde sua empresa está perdendo dinheiro"
        />

        {/* Right Panel - Signup Form */}
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
              <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 via-primary/20 to-accent/20 rounded-3xl blur-xl opacity-50" />
              
              <div className="relative backdrop-blur-xl bg-card/80 border border-border/50 rounded-2xl shadow-2xl p-8 lg:p-10">
                {/* Header */}
                <div className="text-center mb-6">
                  <motion.h1
                    className="text-2xl lg:text-3xl font-bold mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Criar conta gratuita
                  </motion.h1>
                  <motion.p
                    className="text-muted-foreground text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Comece a identificar vazamentos de receita hoje
                  </motion.p>
                </div>

                {/* Form */}
                <form onSubmit={handleSignup} className="space-y-4">
                  <motion.div
                    className="space-y-2"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                  >
                    <Label htmlFor="fullName" className="text-sm font-medium">
                      Nome completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Seu nome"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        disabled={loading}
                        className="h-12 pl-11 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
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
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email
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
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={2}
                  >
                    <Label htmlFor="password" className="text-sm font-medium">
                      Senha
                    </Label>
                    <PasswordInput
                      id="password"
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      showStrength
                      className="h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    />
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={3}
                  >
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      Confirmar senha
                    </Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    />
                  </motion.div>

                  {/* Terms Checkbox */}
                  <motion.div
                    className="flex items-start gap-3 pt-2"
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={4}
                  >
                    <Checkbox 
                      id="terms" 
                      checked={acceptedTerms} 
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      disabled={loading}
                      className="mt-0.5"
                    />
                    <Label 
                      htmlFor="terms" 
                      className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                    >
                      Li e aceito os{' '}
                      <Link 
                        to="/terms" 
                        className="text-primary hover:underline font-medium"
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Termos de Uso
                      </Link>
                      {' '}e a{' '}
                      <Link 
                        to="/privacy" 
                        className="text-primary hover:underline font-medium"
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Política de Privacidade
                      </Link>
                    </Label>
                  </motion.div>

                  <motion.div
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    custom={5}
                  >
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/25"
                      disabled={loading || !acceptedTerms}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Criando conta...
                        </>
                      ) : (
                        'Criar conta'
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/80 px-4 text-muted-foreground">
                      Já tem conta?
                    </span>
                  </div>
                </div>

                {/* Login Link */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-12 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => navigate('/login')}
                  >
                    Fazer login
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  );
}
