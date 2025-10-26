import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await resetPassword(email);
      
      if (error) throw error;

      setEmailSent(true);
      toast({
        title: 'Email enviado!',
        description: 'Se o email existir em nosso sistema, você receberá um link para redefinir sua senha.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar email',
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
          <h1 className="text-2xl font-bold">Recuperar senha</h1>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Esqueceu sua senha?</CardTitle>
            <CardDescription>
              {emailSent 
                ? 'Verifique seu email para continuar' 
                : 'Digite seu email para receber o link de recuperação'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Enviamos um link de recuperação para <strong>{email}</strong>.
                    Verifique sua caixa de entrada e spam.
                  </p>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
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
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/login')}
                  type="button"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
