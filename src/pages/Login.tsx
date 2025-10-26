import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithOtp } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
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
        title: 'Erro ao fazer login',
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
          <h1 className="text-2xl font-bold">Bem-vindo de volta</h1>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Fazer login</CardTitle>
            <CardDescription>
              Digite seu email para receber o código de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
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

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  'Continuar com email'
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
                  Criar conta gratuita
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
