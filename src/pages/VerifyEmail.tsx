import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function VerifyEmail() {
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { user, signOut } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.email_confirmed_at) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          type: 'signup',
          email: user.email,
        }),
      });

      if (!response.ok) throw new Error('Falha ao reenviar email');

      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada.',
      });
      
      setResendCountdown(60);
    } catch (error: any) {
      toast({
        title: 'Erro ao reenviar email',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Verifique seu email</CardTitle>
            <CardDescription>
              Enviamos um link de verificação para {user?.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Por segurança, você precisa verificar seu email antes de acessar o sistema.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                onClick={handleResendVerification}
                disabled={loading || resendCountdown > 0}
                variant="outline"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : resendCountdown > 0 ? (
                  `Reenviar em ${resendCountdown}s`
                ) : (
                  'Reenviar email de verificação'
                )}
              </Button>

              <Button
                onClick={handleLogout}
                variant="ghost"
                className="w-full"
              >
                Sair e fazer login com outra conta
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Não recebeu o email?</p>
              <p className="mt-1">Verifique sua pasta de spam ou tente reenviar.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
