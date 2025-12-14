import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

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
      // Validação client-side
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Header com botão voltar */}
      <header className="w-full p-4 md:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para página inicial
        </Button>
      </header>

      {/* Conteúdo centralizado */}
      <div className="flex-1 flex items-center justify-center p-4 pb-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary-foreground" />
              </div>
              <span className="text-3xl font-bold">NOID CRM</span>
            </div>
            <h1 className="text-2xl font-bold">Criar conta gratuita</h1>
          </div>

          <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
            <CardDescription>
              Preencha os dados para começar a usar o NOID CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <PasswordInput
                  id="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  showStrength
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              {/* Checkbox de aceite dos termos */}
              <div className="flex items-start gap-3 pt-2">
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
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading || !acceptedTerms}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold"
                  onClick={() => navigate('/login')}
                >
                  Fazer login
                </Button>
              </p>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
