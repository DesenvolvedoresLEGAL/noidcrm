import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [countdown, setCountdown] = useState(0);
  const { user, signInWithOtp, verifyOtp } = useSupabaseAuth();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signInWithOtp(email);
      
      if (error) {
        toast.error(error.message || 'Erro ao enviar código');
      } else {
        toast.success('Código enviado para seu email!');
        setStep('otp');
        setCountdown(60);
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast.error('Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }

    setLoading(true);

    try {
      const { error } = await verifyOtp(email, otp);
      
      if (error) {
        toast.error('Código inválido ou expirado');
        setOtp('');
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      const { error } = await signInWithOtp(email);
      
      if (error) {
        toast.error(error.message || 'Erro ao reenviar código');
      } else {
        toast.success('Código reenviado!');
        setCountdown(60);
        setOtp('');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error('Erro ao reenviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp('');
    setCountdown(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-card-hover">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-black bg-gradient-primary bg-clip-text text-transparent">
            NOID CRM
          </CardTitle>
          <CardDescription>
            {step === 'email' 
              ? 'Entre com seu e-mail para receber o código de 6 dígitos' 
              : 'Digite o código de 6 dígitos enviado ao seu e‑mail'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar código'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Enviaremos um código de 6 dígitos para seu email
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBackToEmail}
                className="mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-center block">
                  Código de verificação
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
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
                <p className="text-xs text-center text-muted-foreground">
                  Enviado para {email}
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  Use o código de 6 dígitos enviado ao seu e‑mail.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? 'Verificando...' : 'Verificar código'}
              </Button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Reenviar código em {countdown}s
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleResendOtp}
                    disabled={loading}
                  >
                    Reenviar código
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
