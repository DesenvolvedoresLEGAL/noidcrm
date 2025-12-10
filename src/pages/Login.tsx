import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, Zap, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Credenciais inválidas',
            description: 'Email ou senha incorretos.',
            variant: 'destructive',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            title: 'Email não confirmado',
            description: 'Por favor, confirme seu email antes de fazer login.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        toast({
          title: t('loginSuccess', { ns: 'auth' }),
          description: t('welcome', { ns: 'dashboard' }),
        });
        navigate('/app/dashboard');
      }
    } catch (error: any) {
      toast({
        title: t('loginError', { ns: 'auth' }),
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
        <title>{t('login', { ns: 'auth' })} - {t('appName')}</title>
        <meta name="description" content="Faça login no NOID CRM - Sistema de gestão comercial inteligente" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para página inicial
          </Button>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="text-3xl font-bold">{t('appName')}</span>
            </div>
            <h1 className="text-2xl font-bold">{t('welcome', { ns: 'dashboard' })}</h1>
          </div>

          <Card className="border-2 shadow-xl">
            <CardHeader>
              <CardTitle>{t('login', { ns: 'auth' })}</CardTitle>
              <CardDescription>
                Digite suas credenciais para acessar sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4" aria-label="Formulário de login">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email', { ns: 'auth' })}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                    autoComplete="email"
                    aria-describedby="email-hint"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('password', { ns: 'auth' })}</Label>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-xs"
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
                    className="h-11"
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      {t('loading')}
                    </>
                  ) : (
                    t('login', { ns: 'auth' })
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta?{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto font-semibold"
                    onClick={() => navigate('/signup')}
                  >
                    {t('signup', { ns: 'auth' })}
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
