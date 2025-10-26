import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function Verify() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const { verifyOtp, signInWithOtp } = useSupabaseAuth();
  const { status, loading: statusLoading } = useOnboardingStatus();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/signup');
      return;
    }

    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleVerify = async (value: string) => {
    if (value.length !== 6) return;
    
    setLoading(true);

    try {
      const { error } = await verifyOtp(email, value);
      
      if (error) throw error;

      toast({
        title: 'Verificado com sucesso!',
        description: 'Redirecionando...',
      });

      // Wait for status to be fetched
      setTimeout(() => {
        if (!statusLoading) {
          if (status && !status.completed) {
            navigate('/onboarding');
          } else {
            navigate('/');
          }
        }
      }, 500);
    } catch (error: any) {
      toast({
        title: 'Código inválido',
        description: 'Verifique o código e tente novamente.',
        variant: 'destructive',
      });
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { error } = await signInWithOtp(email);
      if (error) throw error;

      toast({
        title: 'Código reenviado!',
        description: 'Verifique seu email novamente.',
      });

      setResendCountdown(60);
    } catch (error: any) {
      toast({
        title: 'Erro ao reenviar',
        description: error.message,
        variant: 'destructive',
      });
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
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Verifique seu email</CardTitle>
            <CardDescription>
              Enviamos um código de 6 dígitos para <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  if (value.length === 6) {
                    handleVerify(value);
                  }
                }}
                disabled={loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando...
              </div>
            )}

            <div className="text-center">
              {resendCountdown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Reenviar código em {resendCountdown}s
                </p>
              ) : (
                <Button variant="link" onClick={handleResend} className="p-0 h-auto">
                  Reenviar código
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/signup')}
            >
              ← Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
