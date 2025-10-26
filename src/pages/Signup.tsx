import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, ArrowRight } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithOtp } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signInWithOtp(email);
      
      if (error) throw error;

      toast({
        title: 'Código enviado!',
        description: 'Verifique seu email e digite o código de 6 dígitos.',
      });

      navigate('/verify', { state: { email } });
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold">NOID CRM</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Bem-vindo ao futuro das vendas</h1>
          <p className="text-muted-foreground">
            Configure seu CRM completo em menos de 2 minutos
          </p>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Criar conta gratuita</CardTitle>
            <CardDescription>
              Comece seu trial de 14 dias, sem cartão de crédito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email corporativo</Label>
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

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  <>
                    Começar grátis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Ao criar uma conta, você concorda com nossos{' '}
                <a href="#" className="underline hover:text-foreground">
                  Termos de Serviço
                </a>{' '}
                e{' '}
                <a href="#" className="underline hover:text-foreground">
                  Política de Privacidade
                </a>
              </p>
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
  );
}
